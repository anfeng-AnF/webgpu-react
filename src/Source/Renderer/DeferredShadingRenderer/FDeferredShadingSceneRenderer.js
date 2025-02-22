import FSceneRenderer from './FSceneRenderer';
import FResourceManager, { EResourceType } from '../../Core/Resource/FResourceManager';
import * as THREE from 'three';
import FCopyToCanvasPass from './Pass/PostProcess/FCopyToCanvasPass';
import PrePass from './Pass/RenderPass/PrePass';
import GPUScene from '../../Scene/GPUScene';
import StaticMesh from '../../Object3D/Mesh/StaticMesh';
import { createPBRMaterial } from '../../Material/Mat_Instance/PBR';
import { GPUMaterialInstance } from '../../Material/GPUMaterial';
import BasePass from './Pass/RenderPass/BasePass';
import FModuleManager from '../../Core/FModuleManager';
import { resourceName } from './ResourceNames';
import { loadTexture } from '../../Core/Resource/Texture/LoadTexture';
import { FBXLoader } from 'three/examples/jsm/Addons.js';
import { BufferGeometryUtils } from 'three/examples/jsm/Addons.js';
import Scene from '../../Scene/UI/Scene';
import SceneStaticMesh from '../../Scene/UI/Object/SceneStaticMesh';
import DynamicLightPass from './Pass/RenderPass/DynamicLightPass';
import LightingAndShadowPass from './Pass/ComputePass/LightingAndShadowPass';
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


        /**
         * UI场景
         * @type {Scene}
         * @public
         */
        this.Scene = new Scene();
        /**
         * GPU场景
         * @type {GPUScene}
         * @public
         */
        this.GPUScene = new GPUScene(this.Scene, this);

        /**
         * 动态光照Pass
         * @type {DynamicLightPass}
         * @public
         */
        this._DynamicLightPass = new DynamicLightPass();

        /**
         * 光照和阴影Pass
         * @type {LightingAndShadowPass}
         * @public
         */
        this._LightingAndShadowPass = new LightingAndShadowPass();
    }

    /**
     * 初始化渲染器
     */
    async Initialize() {
        //打印执行时间
        this._Device = await FResourceManager.GetInstance().GetDevice();

        // 设置相机初始位置
        this._MainCamera.position.set(0, 2, 5);
        this._MainCamera.lookAt(0, 0, 0);
        this._MainCamera.updateMatrixWorld();

        // 设置场景的主相机
        this.GPUScene.camera = this._MainCamera;

        // 初始化场景
        await this.GPUScene.initBuffers();

        // 创建测试场景
        await this.CreateTestScene();

        // 先初始化场景
        await this.GPUScene.Update(0);

        // 然后初始化 PrePass
        await this._PrePass.InitResourceName();
        await this._PrePass.Initialize(this);
        await this._BasePass.InitResourceName();
        await this._BasePass.Initialize(this);

        await this._LightingAndShadowPass.InitResourceName();
        await this._LightingAndShadowPass.Initialize(this);

        const UIModule = FModuleManager.GetInstance().GetModule('UIModule');
        const DetailBuilder = UIModule.WorldSettingsBuilder;
        DetailBuilder.addProperties({
            '渲染.缓冲显示': {
                value: resourceName.PrePass.depthTexture, // 设置初始值为深度纹理
                label: '缓冲显示',
                type: 'enum',
                options: [
                    { value: resourceName.PrePass.depthTexture, label: '场景深度' },
                    { value: resourceName.BasePass.gBufferA, label: '世界法线' },
                    { value: resourceName.BasePass.gBufferB, label: 'Specular,Roughness,Metallic' },
                    { value: resourceName.BasePass.gBufferC, label: 'BaseColor' },
                    { value: resourceName.BasePass.gBufferD, label: 'Additional' },
                    { value: 'LightingAndShadowPassRT', label: '光照和阴影' },
                ],
                onChange: async (path, value) => {
                    if (this._CopyPass) {
                        this._CopyPass.Destroy();
                        this._CopyPass = new FCopyToCanvasPass(value, this.canvas);
                        await this._CopyPass.Initialize();
                        await this._CopyPass.OnRenderTargetResize(
                            this.canvas.width,
                            this.canvas.height
                        );
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

        //确保资源管理器已经初始化
        while (!this._bInitialized) {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }

        // 更新 PrePass 的渲染目标大小
        if (this._PrePass) {
            await this._PrePass.OnRenderTargetResize(Width, Height);
        }

        if (this._BasePass) {
            await this._BasePass.OnRenderTargetResize(Width, Height);
        }

        if (this._LightingAndShadowPass) {
            await this._LightingAndShadowPass.OnRenderTargetResize(Width, Height);
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
        //确保资源管理器已经初始化
        while (!this._bInitialized) {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }

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

        await this.GPUScene.Update(DeltaTime);

        const commandEncoder = this._Device.createCommandEncoder();

        // 执行PrePass
        await this._PrePass.Render(DeltaTime, this.GPUScene, commandEncoder, this);

        // 执行BasePass
        await this._BasePass.Render(DeltaTime, this.GPUScene, commandEncoder, this);

        await this._DynamicLightPass.Render(DeltaTime, this.GPUScene, commandEncoder, this);

        // 执行光照和阴影Pass
        await this._LightingAndShadowPass.Render(DeltaTime, this.GPUScene, commandEncoder, this);

        // 执行CopyPass
        if (this._CopyPass) {
            this._CopyPass.Render(DeltaTime, commandEncoder);
        }

        this._Device.queue.submit([commandEncoder.finish()]);
    
        //await this.GPUScene.directLight.debugCheckAllCascades();
        //await this.GPUScene.directLight.debugCheckBasicInfo();
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
        // 销毁 ShadowMapPass
        await this._DynamicLightPass.Destroy();
        await this._LightingAndShadowPass.Destroy();
    }

    /**
     * 创建测试场景
     * 添加一些基本几何体用于测试
     */
    async CreateTestScene() {
        const BaseColorTexture = await loadTexture(
            this._ResourceManager,
            'Content/Other/Mat/textures/seaworn_sandstone_brick_diff_4k.jpg'
        );
        const NormalTexture = await loadTexture(
            this._ResourceManager,
            'Content/Other/Mat/textures/seaworn_sandstone_brick_nor_gl_4k.png',
            true
        );
        //const MetallicTexture = await loadTexture(this._ResourceManager, 'public/Texture/Metallic.png');
        const RoughnessTexture = await loadTexture(
            this._ResourceManager,
            'Content/Other/Mat/textures/seaworn_sandstone_brick_rough_4k.png'
        );
        //const SpecularTexture = await loadTexture(this._ResourceManager, 'public/Texture/Specular.png');

        const BaseColorTextureSampler = this._ResourceManager.CreateResource(
            'BaseColorTextureSampler',
            {
                Type: 'Sampler',
                desc: {
                    addressModeU: 'repeat',
                    addressModeV: 'repeat',
                    addressModeW: 'repeat',
                },
            }
        );

        const PBRMaterial = await createPBRMaterial(
            this._ResourceManager,
            BaseColorTexture,
            null, //NormalTexture,
            null,
            RoughnessTexture,
            null,

            BaseColorTextureSampler,
            null, //BaseColorTextureSampler,
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
        const staticPlaneMesh = new StaticMesh(planeMesh, this._ResourceManager);
        staticPlaneMesh.meshID = planeMesh.ID;
        staticPlaneMesh.GPUMaterial = new GPUMaterialInstance(PBRMaterial);
        await this.GPUScene.addStaticMesh(staticPlaneMesh);
        const scenePlaneMesh = new SceneStaticMesh();
        scenePlaneMesh.uuid = staticPlaneMesh.uuid;
        scenePlaneMesh.Position.copy(planeMesh.position);
        scenePlaneMesh.Rotation.copy(planeMesh.rotation);
        scenePlaneMesh.Scale.copy(planeMesh.scale);
        this.Scene.AddChild('plane', scenePlaneMesh);

        // 立方体：金属质感
        let boxGeometry = new THREE.BoxGeometry(1, 1, 1);
        boxGeometry = BufferGeometryUtils.mergeVertices(boxGeometry);
        boxGeometry.computeTangents();
        const boxMesh = new THREE.Mesh(boxGeometry);
        boxMesh.position.set(-1.5, 0, 0);
        boxMesh.ID = 'box';
        const sBoxMesh = await this.GPUScene.add(boxMesh);
        sBoxMesh.GPUMaterial = new GPUMaterialInstance(PBRMaterial);
        sBoxMesh.GPUMaterial.dynamicAttributes.BaseColor = [0.25, 0.25, 1, 1];
        sBoxMesh.GPUMaterial.dynamicAttributes.Specular = 0.5;
        sBoxMesh.GPUMaterial.dynamicAttributes.Metallic = 0.2;
        sBoxMesh.GPUMaterial.dynamicAttributes.Roughness = 0.8;
        const sceneBoxMesh = new SceneStaticMesh();
        sceneBoxMesh.uuid = sBoxMesh.uuid;
        sceneBoxMesh.Position.copy(boxMesh.position);
        sceneBoxMesh.Rotation.copy(boxMesh.rotation);
        sceneBoxMesh.Scale.copy(boxMesh.scale);
        this.Scene.AddChild('box', sceneBoxMesh);
        // 球体：光滑塑料质感
        let sphereGeometry = new THREE.SphereGeometry(0.5, 32, 32);
        sphereGeometry = BufferGeometryUtils.mergeVertices(sphereGeometry);
        sphereGeometry.computeTangents();
        const sphereMesh = new THREE.Mesh(sphereGeometry);
        sphereMesh.position.set(1.5, 0, 0);
        sphereMesh.ID = 'sphere';
        const sSphereMesh = await this.GPUScene.add(sphereMesh);
        sSphereMesh.GPUMaterial = new GPUMaterialInstance(PBRMaterial);
        sSphereMesh.GPUMaterial.dynamicAttributes.BaseColor = [0, 0, 1, 1];
        sSphereMesh.GPUMaterial.dynamicAttributes.Specular = 0.5;
        sSphereMesh.GPUMaterial.dynamicAttributes.Metallic = 0.2;
        sSphereMesh.GPUMaterial.dynamicAttributes.Roughness = 0.8;
        const sceneSphereMesh = new SceneStaticMesh();
        sceneSphereMesh.uuid = sSphereMesh.uuid;
        sceneSphereMesh.Position.copy(sphereMesh.position);
        sceneSphereMesh.Rotation.copy(sphereMesh.rotation);
        sceneSphereMesh.Scale.copy(sphereMesh.scale);
        this.Scene.AddChild('sphere', sceneSphereMesh);
        // 圆柱体：粗糙金属质感
        let cylinderGeometry = new THREE.CylinderGeometry(0.5, 0.5, 2, 32);
        cylinderGeometry = BufferGeometryUtils.mergeVertices(cylinderGeometry);
        cylinderGeometry.computeTangents();
        const cylinderMesh = new THREE.Mesh(cylinderGeometry);
        cylinderMesh.position.set(0, 0, -1.5);
        cylinderMesh.ID = 'cylinder';
        const sCylinderMesh = await this.GPUScene.add(cylinderMesh);
        sCylinderMesh.GPUMaterial = new GPUMaterialInstance(PBRMaterial);
        sCylinderMesh.GPUMaterial.dynamicAttributes.BaseColor = [1, 0.5, 0.25, 1];
        sCylinderMesh.GPUMaterial.dynamicAttributes.Specular = 0.5;
        sCylinderMesh.GPUMaterial.dynamicAttributes.Metallic = 0.2;
        sCylinderMesh.GPUMaterial.dynamicAttributes.Roughness = 0.8;
        const sceneCylinderMesh = new SceneStaticMesh();
        sceneCylinderMesh.uuid = sCylinderMesh.uuid;
        sceneCylinderMesh.Position.copy(cylinderMesh.position);
        sceneCylinderMesh.Rotation.copy(cylinderMesh.rotation);
        sceneCylinderMesh.Scale.copy(cylinderMesh.scale);
        this.Scene.AddChild('cylinder', sceneCylinderMesh);

        // 天空球材质
        const skyboxBaseColorTexture = await loadTexture(
            this._ResourceManager,
            'Content/Texture/0000000352D27C38.png'
        );
        const skyboxBaseColorTextureSampler = this._ResourceManager.CreateResource(
            'skyboxBaseColorTextureSampler',
            {
                Type: 'Sampler',
                desc: {
                    addressModeU: 'repeat',
                    addressModeV: 'repeat',
                    addressModeW: 'repeat',
                },
            }
        );
        const skyboxMaterial = await createPBRMaterial(
            this._ResourceManager,
            skyboxBaseColorTexture,
            null,
            null,
            null,
            null,
            skyboxBaseColorTextureSampler,
            null,
            null,
            null,
            null
        );
        console.log(PBRMaterial);
        console.log(skyboxMaterial);
        // 天空球
        const FBXloader = new FBXLoader();
        const model = await FBXloader.loadAsync('Content/Module/Test/skyBox.fbx');
        model.children[0].geometry.attributes.uv =
            model.children[0].geometry.attributes.uv5.clone();
        const SkySphereMesh = model.children[0];
        SkySphereMesh.geometry = BufferGeometryUtils.mergeVertices(SkySphereMesh.geometry);

        // 生成切线属性
        SkySphereMesh.geometry.computeTangents();

        console.log(SkySphereMesh);
        SkySphereMesh.ID = 'SkySphere';
        SkySphereMesh.position.set(0, -5555, 0);
        SkySphereMesh.scale.set(1, 1, 1);
        const sSkySphereMesh = await this.GPUScene.add(SkySphereMesh);
        sSkySphereMesh.GPUMaterial = new GPUMaterialInstance(skyboxMaterial);
        sSkySphereMesh.GPUMaterial.dynamicAttributes.BaseColor = [1, 0, 0, 1];
        sSkySphereMesh.GPUMaterial.dynamicAttributes.Specular = 0.0; // 完全镜面反射
        sSkySphereMesh.GPUMaterial.dynamicAttributes.Metallic = 0.0; // 非金属
        sSkySphereMesh.GPUMaterial.dynamicAttributes.Roughness = 0.0; // 完全光滑

        this.GPUScene.upLoadMeshToGPU();

        const sceneSkySphereMesh = new SceneStaticMesh();
        sceneSkySphereMesh.uuid = sSkySphereMesh.uuid;
        sceneSkySphereMesh.Position.copy(SkySphereMesh.position);
        sceneSkySphereMesh.Rotation.copy(SkySphereMesh.rotation);
        sceneSkySphereMesh.Scale.copy(SkySphereMesh.scale);
        this.Scene.AddChild('SkySphere', sceneSkySphereMesh);
        const light = new THREE.DirectionalLight(0xffffff, 1);
        light.position.set(0, 0, 0);
        light.target.position.set(0, 0, 0);
        light.updateMatrixWorld(true);
        console.log(light);

        this.Scene.Name = '测试场景';
        this.Scene.Update();
    }
}

export default FDeferredShadingSceneRenderer;
