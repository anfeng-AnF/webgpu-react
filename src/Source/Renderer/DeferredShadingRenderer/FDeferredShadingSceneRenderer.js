import FSceneRenderer from './FSceneRenderer';
import FResourceManager, { EResourceType } from '../../Core/Resource/FResourceManager';
import * as THREE from 'three';
import FCopyToCanvasPass from './Pass/PostProcess/FCopyToCanvasPass';
import PrePass from './Pass/RenderPass/PrePass';
import GPUScene from '../../Scene/GPUScene';
import StaticMesh from '../../Mesh/StaticMesh';
import { createPBRMaterial } from '../../Material/Mat_Instance/PBR';
import { GPUMaterialInstance } from '../../Material/GPUMaterial';
import BasePass from './Pass/RenderPass/BasePass';
import FModuleManager from '../../Core/FModuleManager';
import { resourceName } from './ResourceNames';
import { loadTexture } from '../../Core/Resource/Texture/LoadTexture';
import { FBXLoader } from 'three/examples/jsm/Addons.js';
import { BufferGeometryUtils } from 'three/examples/jsm/Addons.js';
import { PI } from 'three/tsl';

class FDeferredShadingSceneRenderer extends FSceneRenderer {
    constructor() {
        super();

        /**
         * 资源管理器
         * @type {FResourceManager}
         * @protected
         */
        this._ResourceManager = FResourceManager.GetInstance();

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
         * Base Pass
         * @type {BasePass}
         * @protected
         */
        this._BasePass = new BasePass();

        /**
         * 主相机
         * @type {THREE.PerspectiveCamera}
         * @protected
         */
        this._MainCamera = new THREE.PerspectiveCamera(
            60, // FOV
            window.innerWidth / window.innerHeight,
            0.1, // near
            1e7 // far
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
        await this._BasePass.InitResourceName();
        await this._BasePass.Initialize(this);

        await this.OnCanvasResize(window.innerWidth, window.innerHeight, this.canvas);

        const UIModule = FModuleManager.GetInstance().GetModule('UIModule');
        const DetailBuilder = UIModule.GetDetailBuilder();
        DetailBuilder.addProperties({
            '渲染.缓冲显示': {
                value: resourceName.PrePass.depthTexture,  // 设置初始值为深度纹理
                label: '缓冲显示',
                type: 'enum',
                options: [
                    { value: resourceName.PrePass.depthTexture, label: '场景深度' },
                    { value: resourceName.BasePass.gBufferA, label: '世界法线' },
                    { value: resourceName.BasePass.gBufferB, label: 'Specular,Roughness,Metallic' },
                    { value: resourceName.BasePass.gBufferC, label: 'BaseColor' },
                    { value: resourceName.BasePass.gBufferD, label: 'Additional' },
                    //{ value:'Content/Other/Mat/textures/seaworn_sandstone_brick_rough_4k.png', label: 'test' },
                ],
                onChange: async (path, value) => {
                    if (this._CopyPass) {
                        this._CopyPass.Destroy();
                        this._CopyPass = new FCopyToCanvasPass(value, this.canvas);
                        await this._CopyPass.Initialize();
                        await this._CopyPass.OnRenderTargetResize(this.canvas.width, this.canvas.height);
                    }
                },
            },
        });

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

        
        if (this._BasePass) {
            await this._BasePass.OnRenderTargetResize(Width, Height);
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
        // 初始化复制Pass，使用PrePass的深度纹理作为初始源
        this._CopyPass = new FCopyToCanvasPass(resourceName.PrePass.depthTexture, Canvas);
        await this._CopyPass.Initialize();
        this.canvas = Canvas;
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

        // 执行PrePass
        await this._PrePass.Render(DeltaTime, this.Scene, commandEncoder, this);

        // 执行BasePass
        await this._BasePass.Render(DeltaTime, this.Scene, commandEncoder, this);

        // 执行CopyPass
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
        // 销毁 BasePass
        await this._BasePass.Destroy();
    }

    /**
     * 创建测试场景
     * 添加一些基本几何体用于测试
     */
    async CreateTestScene() {
        const BaseColorTexture = await loadTexture(this._ResourceManager, 'Content/Other/Mat/textures/seaworn_sandstone_brick_diff_4k.jpg');
        const NormalTexture = await loadTexture(this._ResourceManager, 'Content/Other/Mat/textures/seaworn_sandstone_brick_nor_gl_4k.png');
        //const MetallicTexture = await loadTexture(this._ResourceManager, 'public/Texture/Metallic.png');
        const RoughnessTexture = await loadTexture(this._ResourceManager, 'Content/Other/Mat/textures/seaworn_sandstone_brick_rough_4k.png');
        //const SpecularTexture = await loadTexture(this._ResourceManager, 'public/Texture/Specular.png');

        const BaseColorTextureSampler = this._ResourceManager.CreateResource('BaseColorTextureSampler', {
            Type: 'Sampler',
            desc: {
                addressModeU: 'repeat',
                addressModeV: 'repeat',
                addressModeW: 'repeat',
            }
        });



        const PBRMaterial = await createPBRMaterial(
            this._ResourceManager,
            BaseColorTexture,
            NormalTexture,
            null,
            RoughnessTexture,
            null,

            BaseColorTextureSampler,
            BaseColorTextureSampler,
            null,
            BaseColorTextureSampler,
            null
        );

        // 创建一个水平地面（使用扁平的立方体代替平面）
        let planeGeometry = new THREE.BoxGeometry(10, 0.1, 10);
        planeGeometry = BufferGeometryUtils.mergeVertices(planeGeometry);
        planeGeometry.computeTangents();
        const planeMesh = new THREE.Mesh(planeGeometry);
        planeMesh.position.y = -1;
        planeMesh.updateMatrixWorld(true);
        planeMesh.ID = 'plane';
        const [sScene1, sPlaneMesh] = await this.Scene.add(planeMesh);
        sPlaneMesh.GPUMaterial = new GPUMaterialInstance(PBRMaterial);
        sPlaneMesh.GPUMaterial.dynamicAttributes.BaseColor = [0.25, 1, 0, 1];
        // 地面：低金属度，中等粗糙度
        sPlaneMesh.GPUMaterial.dynamicAttributes.Specular = 0.0;  
        sPlaneMesh.GPUMaterial.dynamicAttributes.Metallic = 0.0;  
        sPlaneMesh.GPUMaterial.dynamicAttributes.Roughness = 0.0; 

        // 立方体：金属质感
        let boxGeometry = new THREE.BoxGeometry(1, 1, 1);
        boxGeometry = BufferGeometryUtils.mergeVertices(boxGeometry);
        boxGeometry.computeTangents();
        const boxMesh = new THREE.Mesh(boxGeometry);
        boxMesh.position.set(-1.5, 0, 0);
        boxMesh.ID = 'box';
        const [sScene2, sBoxMesh] = await this.Scene.add(boxMesh);
        sBoxMesh.GPUMaterial = new GPUMaterialInstance(PBRMaterial);
        sBoxMesh.GPUMaterial.dynamicAttributes.BaseColor = [0.25, 0.25, 1, 1];
        sBoxMesh.GPUMaterial.dynamicAttributes.Specular = 0.0;   
        sBoxMesh.GPUMaterial.dynamicAttributes.Metallic = 0.0;   
        sBoxMesh.GPUMaterial.dynamicAttributes.Roughness = 0.0;  

        // 球体：光滑塑料质感
        let sphereGeometry = new THREE.SphereGeometry(0.5, 32, 32);
        sphereGeometry = BufferGeometryUtils.mergeVertices(sphereGeometry);
        sphereGeometry.computeTangents();
        const sphereMesh = new THREE.Mesh(sphereGeometry);
        sphereMesh.position.set(1.5, 0, 0);
        sphereMesh.ID = 'sphere';
        const [sScene3, sSphereMesh] = await this.Scene.add(sphereMesh);
        sSphereMesh.GPUMaterial = new GPUMaterialInstance(PBRMaterial);
        sSphereMesh.GPUMaterial.dynamicAttributes.BaseColor = [0, 0, 1, 1];
        sSphereMesh.GPUMaterial.dynamicAttributes.Specular = 0.0;   
        sSphereMesh.GPUMaterial.dynamicAttributes.Metallic = 0.0;   
        sSphereMesh.GPUMaterial.dynamicAttributes.Roughness = 0.0;  

        // 圆柱体：粗糙金属质感
        let cylinderGeometry = new THREE.CylinderGeometry(0.5, 0.5, 2, 32);
        cylinderGeometry = BufferGeometryUtils.mergeVertices(cylinderGeometry);
        cylinderGeometry.computeTangents();
        const cylinderMesh = new THREE.Mesh(cylinderGeometry);
        cylinderMesh.position.set(0, 0, -1.5);
        cylinderMesh.ID = 'cylinder';
        const [sScene4, sCylinderMesh] = await this.Scene.add(cylinderMesh);
        sCylinderMesh.GPUMaterial = new GPUMaterialInstance(PBRMaterial);
        sCylinderMesh.GPUMaterial.dynamicAttributes.BaseColor = [1, 0.5, 0.25, 1];
        sCylinderMesh.GPUMaterial.dynamicAttributes.Specular = 0.0;   
        sCylinderMesh.GPUMaterial.dynamicAttributes.Metallic = 0.0;   
        sCylinderMesh.GPUMaterial.dynamicAttributes.Roughness = 0.0;  

        // 天空球材质
        const skyboxBaseColorTexture = await loadTexture(this._ResourceManager, 'Content/Texture/0000000352D27C38.png');
        const skyboxBaseColorTextureSampler = this._ResourceManager.CreateResource('skyboxBaseColorTextureSampler', {
            Type: 'Sampler',
            desc: {
                addressModeU: 'repeat',
                addressModeV: 'repeat',
                addressModeW: 'repeat',
            }
        });
        const skyboxMaterial =await createPBRMaterial(this._ResourceManager, skyboxBaseColorTexture, null, null, null, null, skyboxBaseColorTextureSampler, null, null, null, null);
        console.log(PBRMaterial);
        console.log(skyboxMaterial);
        // 天空球
        const FBXloader = new FBXLoader();
        const model = await FBXloader.loadAsync('Content/Module/Test/skyBox.fbx');
        model.children[0].geometry.attributes.uv = model.children[0].geometry.attributes.uv5.clone();
        const SkySphereMesh = model.children[0];
        SkySphereMesh.geometry = BufferGeometryUtils.mergeVertices(SkySphereMesh.geometry);

        // 生成切线属性
        SkySphereMesh.geometry.computeTangents();

        console.log(SkySphereMesh);
        SkySphereMesh.ID = 'SkySphere';
        SkySphereMesh.position.set(0, -5555, 0);
        SkySphereMesh.scale.set(1,1,1);
        const [sScene5, sSkySphereMesh] = await this.Scene.add(SkySphereMesh);
        sSkySphereMesh.GPUMaterial = new GPUMaterialInstance(skyboxMaterial);
        sSkySphereMesh.GPUMaterial.dynamicAttributes.BaseColor = [1, 0, 0, 1];
        sSkySphereMesh.GPUMaterial.dynamicAttributes.Specular = 0.0;   // 完全镜面反射
        sSkySphereMesh.GPUMaterial.dynamicAttributes.Metallic = 0.0;   // 非金属
        sSkySphereMesh.GPUMaterial.dynamicAttributes.Roughness = 0.0;  // 完全光滑

        this.Scene.upLoadMeshToGPU();
    }
}

export default FDeferredShadingSceneRenderer;
