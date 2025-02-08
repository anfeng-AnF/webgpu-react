import FSceneRenderer from './FSceneRenderer';
import FResourceManager, { EResourceType } from '../../Core/Resource/FResourceManager';
import * as THREE from 'three';
import FCopyToCanvasPass from './Pass/PostProcess/FCopyToCanvasPass';
import PrePass from './Pass/RenderPass/PrePass';
import GPUScene from '../../Scene/GPUScene';

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
         * @type {GPUScene}
         * @public
         */
        this.Scene = new GPUScene();

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
        this.Scene.camera = this._MainCamera;
        
        // 初始化场景
        await this.Scene.initBuffers();

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
        /**
         * 因为有资源依赖关系，必须先调用先使用资源的Pass，再调用后使用资源的Pass  (RDG未实现)
         * 比如 CopyPass 依赖 PrePass 的深度纹理，所以必须先更新 PrePass 的渲染目标大小，再更新 CopyPass 的渲染目标大小
         */

        // 更新 PrePass 的渲染目标大小
        if (this._PrePass) {
            await this._PrePass.OnRenderTargetResize(Width, Height);
        }
        
        if (this._CopyPass) {
            await this._CopyPass.OnRenderTargetResize(Width, Height);
        }
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

        planeMesh.updateMatrixWorld(true); // 确保世界矩阵更新
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

        // 创建天空球几何体并翻转面
        const skyGeometry = new THREE.SphereGeometry(30, 32, 32);
        // 翻转所有三角形的顶点顺序
        const indices = skyGeometry.getIndex().array;
        for (let i = 0; i < indices.length; i += 3) {
            // 交换第二个和第三个顶点的索引，实现面的翻转
            const temp = indices[i + 1];
            indices[i + 1] = indices[i + 2];
            indices[i + 2] = temp;
        }
        skyGeometry.setIndex(new THREE.BufferAttribute(indices, 1));

        const SkySphereMesh = new THREE.Mesh(skyGeometry);
        SkySphereMesh.position.set(0, 0, 0);
        SkySphereMesh.ID = 'SkySphere';
        await this.Scene.add(SkySphereMesh);

        this.Scene.upLoadMeshToGPU();
        //this.Scene.updateAllMeshInfo();
    }
}

export default FDeferredShadingSceneRenderer;
