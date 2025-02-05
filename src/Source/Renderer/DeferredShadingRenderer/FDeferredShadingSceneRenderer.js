import FSceneRenderer from './FSceneRenderer';
import FResourceManager, { EResourceType } from '../../Core/Resource/FResourceManager';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import TestRenderer from './Test/TestRenderer';
import FCopyToCanvasPass from './Pass/PostProcess/FCopyToCanvasPass';
import ShaderIncluder from '../../Core/Shader/ShaderIncluder';
import FScene from '../../Engine/Scene/Scene';
import PrePass from './Pass/RenderPass/PrePass';
import FModuleManager from '../../Core/FModuleManager';

class FDeferredShadingSceneRenderer extends FSceneRenderer {
    constructor() {
        super();

        /**
         * 资源管理器
         * @type {FResourceManager}
         * @protected
         */
        this._ResourceManager = null;

        /**
         * 场景
         * @type {FScene}
         * @public
         */
        this.Scene = new FScene();

        /**
         * 设备
         * @type {GPUDevice}
         * @protected
         */
        this._Device = null;

        /**
         * Early-Z Pass
         * @type {PrePass}
         * @protected
         */
        this._PrePass = new PrePass();

        /**
         * 主相机
         * @type {THREE.PerspectiveCamera}
         * @protected
         */
        this._MainCamera = new THREE.PerspectiveCamera(
            60,  // FOV
            window.innerWidth / window.innerHeight,
            0.1,  // near
            100.0 // far
        );

        /**
         * 复制Pass，用于显示深度图
         * @type {FCopyToCanvasPass}
         * @protected
         */
        this._CopyPass = null;

        // 添加到 UI
        this.#InitializeCameraUI();
    }

    /**
     * 初始化相机UI控制
     * @private
     */
    async #InitializeCameraUI() {
        const UIModule = FModuleManager.GetInstance().GetModule('UIModule');
        const DetailBuilder = UIModule.GetDetailBuilder();

        // 创建相机控制
        DetailBuilder.addProperties({
            'Camera.Position': {
                value: [0, 2, 5], // 默认相机位置
                label: '相机位置',
                type: 'vector3',
                onChange: (path, value) => {
                    this._MainCamera.position.set(value[0], value[1], value[2]);
                    this._MainCamera.updateMatrixWorld();
                },
            },
            'Camera.Target': {
                value: [0, 0, 0], // 默认观察点
                label: '观察点',
                type: 'vector3',
                onChange: (path, value) => {
                    this._MainCamera.lookAt(value[0], value[1], value[2]);
                    this._MainCamera.updateMatrixWorld();
                },
            },
            'Camera.FOV': {
                value: 60,
                label: '视野角度',
                type: 'float',
                min: 1,
                max: 179,
                onChange: (path, value) => {
                    this._MainCamera.fov = value;
                    this._MainCamera.updateProjectionMatrix();
                },
            },
            'Camera.Near': {
                value: 0.1,
                label: '近裁面',
                type: 'float',
                min: 0.01,
                max: 10,
                onChange: (path, value) => {
                    this._MainCamera.near = value;
                    this._MainCamera.updateProjectionMatrix();
                },
            },
            'Camera.Far': {
                value: 100,
                label: '远裁面',
                type: 'float',
                min: 1,
                max: 1000,
                onChange: (path, value) => {
                    this._MainCamera.far = value;
                    this._MainCamera.updateProjectionMatrix();
                },
            },
        });
    }

    /**
     * 初始化渲染器
     */
    async Initialize() {
        this._Device = await FResourceManager.GetInstance().GetDevice();
        
        // 设置相机初始位置
        this._MainCamera.position.set(0, 2, 5);
        this._MainCamera.lookAt(0, 0, 0);
        this._MainCamera.updateMatrixWorld();
        
        // 设置场景的主相机
        this.Scene.SetMainCamera(this._MainCamera);
        
        // 创建测试场景
        await this.CreateTestScene();
        
        // 先初始化场景
        await this.Scene.Update(0);
        
        // 然后初始化 PrePass
        await this._PrePass.InitResourceName();
        await this._PrePass.Initialize(this);
        
        this._bInitialized = true;
    }

    /**
     * 画布尺寸变化
     * @param {number} Width 宽度
     * @param {number} Height 高度
     * @param {HTMLCanvasElement} Canvas 画布
     */
    async OnCanvasResize(Width, Height, Canvas) {
        if (this._CopyPass) {
            await this._CopyPass.OnRenderTargetResize(Width, Height);
        }

        // 更新 PrePass 的渲染目标大小
        await this._PrePass.OnRenderTargetResize(Width, Height);

        // 更新相机宽高比
        this._MainCamera.aspect = Width / Height;
        this._MainCamera.updateProjectionMatrix();

        this._bResizeCompleted = true;
    }

    /**
     * 画布准备完成
     * @param {HTMLCanvasElement} Canvas 画布
     */
    async OnCanvasReady(Canvas) {
        // 初始化复制Pass，使用PrePass的深度纹理
        this._CopyPass = new FCopyToCanvasPass(this._PrePass.RenderTargetTexture, Canvas);
        await this._CopyPass.Initialize();

        this._bCanvasReady = true;
    }

    /**
     * 渲染场景
     * @param {number} DeltaTime 时间差
     */
    async Render(DeltaTime) {
        super.Render(DeltaTime);
        
        if (!this._bInitialized) {
            return;
        }
        
        await this.Scene.Update(DeltaTime);
        
        const commandEncoder = this._Device.createCommandEncoder();
        
        await this._PrePass.Render(DeltaTime, this.Scene, commandEncoder, this);

        if (this._CopyPass) {
            this._CopyPass.Render(DeltaTime, commandEncoder);
        }

        this._Device.queue.submit([commandEncoder.finish()]);
    }

    /**
     * 销毁渲染器
     */
    async Destroy() {
        if (this._CopyPass) {
            this._CopyPass.Destroy();
        }

        // 销毁 PrePass
        await this._PrePass.Destroy();
    }

    /**
     * 创建测试场景
     * 添加一些基本几何体用于测试
     */
    async CreateTestScene() {
        // 创建一个水平地面平面
        const planeGeometry = new THREE.PlaneGeometry(10, 10);
        const planeMesh = new THREE.Mesh(planeGeometry);
        // 先设置旋转，再设置位置
        planeMesh.rotation.x = -Math.PI / 2; // 绕X轴旋转-90度使其水平
        planeMesh.position.y = -1;

        planeMesh.updateMatrix(); // 确保矩阵更新
        planeMesh.ID = 'plane';
        await this.Scene.add(planeMesh);

        // 调整其他物体的位置
        const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
        const boxMesh = new THREE.Mesh(boxGeometry);
        boxMesh.position.set(-1.5, 0, 0);
        boxMesh.ID = 'box';
        await this.Scene.add(boxMesh);

        const sphereGeometry = new THREE.SphereGeometry(0.5, 32, 32);
        const sphereMesh = new THREE.Mesh(sphereGeometry);
        sphereMesh.position.set(1.5, 0, 0);
        sphereMesh.ID = 'sphere';
        await this.Scene.add(sphereMesh);

        const cylinderGeometry = new THREE.CylinderGeometry(0.5, 0.5, 2, 32);
        const cylinderMesh = new THREE.Mesh(cylinderGeometry);
        cylinderMesh.position.set(0, 0, -1.5);
        cylinderMesh.ID = 'cylinder';
        await this.Scene.add(cylinderMesh);

        // 确保所有网格的矩阵都被更新
        this.Scene.updateMatrixWorld(true);
    }
}

export default FDeferredShadingSceneRenderer;
