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
import DirectionalLight from '../../Scene/UI/Object/DirectionalLight';
import Filter from '../../Scene/UI/Object/Filter';
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
            5e4 // far
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
        // mat1 textures
        const BaseColorTexture = await loadTexture(
            this._ResourceManager,
            'Content/Other/Mat/Foil002/Foil002_4K-JPG_Color.jpg'
        );
        const NormalTexture = await loadTexture(
            this._ResourceManager,
            'Content/Other/Mat/Foil002/Foil002_4K-JPG_NormalDX.jpg'
        );
        //const MetallicTexture = await loadTexture(this._ResourceManager, 'public/Texture/Metallic.png');
        const RoughnessTexture = await loadTexture(
            this._ResourceManager,
            'Content/Other/Mat/Foil002/Foil002_4K-JPG_Roughness.jpg'
        );
        const MetallicTexture = await loadTexture(
            this._ResourceManager,
            'Content/Other/Mat/Foil002/Foil002_4K-JPG_Metalness.jpg'
        );
        //const SpecularTexture = await loadTexture(this._ResourceManager, 'public/Texture/Specular.png');

        // mat2 textures
        const BaseColorMetal055 = await loadTexture(
            this._ResourceManager,
            '/Content/Other/Mat/Metal055A/Metal055A_4K-JPG_Color.jpg'
        );
        const NormalMetal055 = await loadTexture(
            this._ResourceManager,
            '/Content/Other/Mat/Metal055A/Metal055A_4K-JPG_NormalDX.jpg'
        );
        const MetallicMetal055 = await loadTexture(
            this._ResourceManager,
            '/Content/Other/Mat/Metal055A/Metal055A_4K-JPG_Metalness.jpg'
        );
        const RoughnessMetal055 = await loadTexture(
            this._ResourceManager,
            '/Content/Other/Mat/Metal055A/Metal055A_4K-JPG_Roughness.jpg'
        );

        // mat3 textures
        const BaseColorTexturePavingStones085 = await loadTexture(
            this._ResourceManager,
            'Content/Other/Mat/PavingStones085/PavingStones085_4K-JPG_Color.jpg'
        );
        const NormalTexturePavingStones085 = await loadTexture(
            this._ResourceManager,
            'Content/Other/Mat/PavingStones085/PavingStones085_4K-JPG_NormalDX.jpg'
        );
        const RoughnessPavingStones085 = await loadTexture(
            this._ResourceManager,
            'Content/Other/Mat/PavingStones085/PavingStones085_4K-JPG_Roughness.jpg'
        );

        // mat4 textures
        const BaseColorTextureMetal034 = await loadTexture(
            this._ResourceManager,
            'Content/Other/Mat/Metal034/Metal034_4K-JPG_Color.jpg'
        );
        const NormalTextureMetal034 = await loadTexture(
            this._ResourceManager,
            'Content/Other/Mat/Metal034/Metal034_4K-JPG_NormalDX.jpg'
        );
        const RoughnessMetal034 = await loadTexture(
            this._ResourceManager,
            'Content/Other/Mat/Metal034/Metal034_4K-JPG_Roughness.jpg'
        );
        const MetallicMetal034 = await loadTexture(
            this._ResourceManager,
            'Content/Other/Mat/Metal034/Metal034_4K-JPG_Metalness.jpg'
        );
        
        // mat5 textures
        const BaseColorTextureRock017 = await loadTexture(
            this._ResourceManager,
            'Content/Other/Mat/Rock017/Rock017_4K-JPG_Color.jpg'
        );
        const NormalTextureRock017 = await loadTexture(
            this._ResourceManager,
            'Content/Other/Mat/Rock017/Rock017_4K-JPG_NormalDX.jpg'
        );
        const RoughnessRock017 = await loadTexture(
            this._ResourceManager,
            'Content/Other/Mat/Rock017/Rock017_4K-JPG_Roughness.jpg'
        );
        
        
        
        
        
        
        

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

        const PBRMaterialPavingStones085 = await createPBRMaterial(
            this._ResourceManager,
            BaseColorTexturePavingStones085,
            NormalTexturePavingStones085,
            null,
            RoughnessPavingStones085,
            null,
            BaseColorTextureSampler,
            BaseColorTextureSampler,
            BaseColorTextureSampler,
            BaseColorTextureSampler,
            BaseColorTextureSampler
        );

        const PBRMaterialMetal055 = await createPBRMaterial(
            this._ResourceManager,
            BaseColorMetal055,
            NormalMetal055,
            MetallicMetal055,
            RoughnessMetal055,
            null,

            BaseColorTextureSampler,
            BaseColorTextureSampler,
            BaseColorTextureSampler,
            BaseColorTextureSampler,
            null
        );

        const PBRMaterialFoil002 = await createPBRMaterial(
            this._ResourceManager,
            BaseColorTexture,
            NormalTexture,
            MetallicTexture,
            RoughnessTexture,
            null,

            BaseColorTextureSampler,
            BaseColorTextureSampler,
            BaseColorTextureSampler,
            BaseColorTextureSampler,
            null
        );

        const PBRMaterialMetal034 = await createPBRMaterial(
            this._ResourceManager,
            BaseColorTextureMetal034,
            NormalTextureMetal034,
            MetallicMetal034,
            RoughnessMetal034,
            null,

            BaseColorTextureSampler,
            BaseColorTextureSampler,
            BaseColorTextureSampler,
            BaseColorTextureSampler,
            BaseColorTextureSampler,
        );

        const PBRMaterialRock017 = await createPBRMaterial(
            this._ResourceManager,
            BaseColorTextureRock017,
            NormalTextureRock017,
            null,
            RoughnessRock017,
            null,

            BaseColorTextureSampler,
            BaseColorTextureSampler,
            BaseColorTextureSampler,
            BaseColorTextureSampler,
            BaseColorTextureSampler,
        );

        const createRandomMeshScene = async (material, dynamicOffset = new THREE.Vector3(75, 0, 0)) => {
            const filter = new Filter();
            filter.Name = 'testObject';
            this.Scene.AddChild('Filter', filter);
    
            // 创建一个水平地面
            let planeGeometry = new THREE.BoxGeometry(100, 0.1, 100);
            planeGeometry = BufferGeometryUtils.mergeVertices(planeGeometry);
            planeGeometry.computeTangents();
            const planeMesh = new THREE.Mesh(planeGeometry);
            planeMesh.position.y = -1;
            planeMesh.position.set(dynamicOffset.x, dynamicOffset.y, dynamicOffset.z);
            planeMesh.updateMatrixWorld(true);
            planeMesh.ID = 'plane';
            
            const staticPlaneMesh = new StaticMesh(planeMesh, this._ResourceManager);
            staticPlaneMesh.meshID = planeMesh.ID;
            staticPlaneMesh.GPUMaterial = new GPUMaterialInstance(PBRMaterialPavingStones085);
            // 设置地面的固定材质属性
            staticPlaneMesh.GPUMaterial.dynamicAttributes.Specular = 0.5;
            staticPlaneMesh.GPUMaterial.dynamicAttributes.Metallic = 0.0;  // 非金属
            staticPlaneMesh.GPUMaterial.dynamicAttributes.Roughness = 0.8; // 较粗糙
            await this.GPUScene.addStaticMesh(staticPlaneMesh);
            
            const scenePlaneMesh = new SceneStaticMesh();
            scenePlaneMesh.uuid = staticPlaneMesh.uuid;
            scenePlaneMesh.Position.copy(planeMesh.position);
            scenePlaneMesh.Rotation.copy(planeMesh.rotation);
            scenePlaneMesh.Scale.copy(planeMesh.scale);
            filter.AddChild('plane', scenePlaneMesh);
            
            let num = 100;

            // 固定的材质属性组
            const materialPresets = [
                {
                    // 塑料
                    specular: 1.0,
                    metallic: 0.0,
                    roughness: 0.8
                }
            ];

            for (let i = 0; i < num; i++) {
                // 从预设中选择材质
                const materialProps = materialPresets[i % materialPresets.length];
                const currentMat = material[i % material.length];

                // 生成随机位置、旋转
                const getRandomPosition = () => {
                    return {
                        x: (Math.random() * 2 - 1) * 25,
                        y: Math.random() * 30 + 1,
                        z: (Math.random() * 2 - 1) * 25,
                    };
                };

                const getRandomRotation = () => {
                    return {
                        x: Math.random() * Math.PI * 2,
                        y: Math.random() * Math.PI * 2,
                        z: Math.random() * Math.PI * 2,
                    };
                };

                // 使用固定缩放
                const scale = { x: 1, y: 1, z: 1 };

                // 立方体：随机金属质感
                let boxGeometry = new THREE.BoxGeometry(1, 1, 1);
                boxGeometry = BufferGeometryUtils.mergeVertices(boxGeometry);
                boxGeometry.computeTangents();
                const boxMesh = new THREE.Mesh(boxGeometry);
                const boxPos = getRandomPosition();
                const boxRot = getRandomRotation();
                const boxScale = scale;
                boxMesh.position.set(boxPos.x + dynamicOffset.x, boxPos.y + dynamicOffset.y, boxPos.z + dynamicOffset.z);
                boxMesh.rotation.set(boxRot.x, boxRot.y, boxRot.z);
                boxMesh.scale.set(boxScale.x, boxScale.y, boxScale.z);
                boxMesh.ID = `box${i}`;
                const sBoxMesh = await this.GPUScene.add(boxMesh);
                const boxMat = materialProps;
                sBoxMesh.GPUMaterial = new GPUMaterialInstance(currentMat);
                sBoxMesh.GPUMaterial.dynamicAttributes.BaseColor = [0.7, 0.7, 0.8, 1];
                sBoxMesh.GPUMaterial.dynamicAttributes.Specular = boxMat.specular;
                sBoxMesh.GPUMaterial.dynamicAttributes.Metallic = boxMat.metallic;
                sBoxMesh.GPUMaterial.dynamicAttributes.Roughness = boxMat.roughness;
                const sceneBoxMesh = new SceneStaticMesh(sBoxMesh);
                sceneBoxMesh.uuid = sBoxMesh.uuid;
                sceneBoxMesh.Position.copy(boxMesh.position);
                sceneBoxMesh.Rotation.copy(boxMesh.rotation);
                sceneBoxMesh.Scale.copy(boxMesh.scale);
                filter.AddChild(`box${i}`, sceneBoxMesh);

                // 球体：随机塑料/金属质感
                let sphereGeometry = new THREE.SphereGeometry(0.5, 32, 32);
                sphereGeometry = BufferGeometryUtils.mergeVertices(sphereGeometry);
                sphereGeometry.computeTangents();
                const sphereMesh = new THREE.Mesh(sphereGeometry);
                const spherePos = getRandomPosition();
                const sphereRot = getRandomRotation();
                const sphereScale = scale;
                sphereMesh.position.set(spherePos.x + dynamicOffset.x, spherePos.y + dynamicOffset.y, spherePos.z + dynamicOffset.z);
                sphereMesh.rotation.set(sphereRot.x, sphereRot.y, sphereRot.z);
                sphereMesh.scale.set(sphereScale.x, sphereScale.y, sphereScale.z);
                sphereMesh.ID = `sphere${i}`;
                const sSphereMesh = await this.GPUScene.add(sphereMesh);
                const sphereMat = materialProps;
                sSphereMesh.GPUMaterial = new GPUMaterialInstance(currentMat);
                sSphereMesh.GPUMaterial.dynamicAttributes.BaseColor = [0.8, 0.2, 0.2, 1];
                sSphereMesh.GPUMaterial.dynamicAttributes.Specular = sphereMat.specular;
                sSphereMesh.GPUMaterial.dynamicAttributes.Metallic = sphereMat.metallic;
                sSphereMesh.GPUMaterial.dynamicAttributes.Roughness = sphereMat.roughness;
                const sceneSphereMesh = new SceneStaticMesh(sSphereMesh);
                sceneSphereMesh.uuid = sSphereMesh.uuid;
                sceneSphereMesh.Position.copy(sphereMesh.position);
                sceneSphereMesh.Rotation.copy(sphereMesh.rotation);
                sceneSphereMesh.Scale.copy(sphereMesh.scale);
                filter.AddChild(`sphere${i}`, sceneSphereMesh);

                // 圆柱体：随机金属质感
                let cylinderGeometry = new THREE.CylinderGeometry(0.5, 0.5, 2, 32);
                cylinderGeometry = BufferGeometryUtils.mergeVertices(cylinderGeometry);
                cylinderGeometry.computeTangents();
                const cylinderMesh = new THREE.Mesh(cylinderGeometry);
                const cylinderPos = getRandomPosition();
                const cylinderRot = getRandomRotation();
                const cylinderScale = scale;
                cylinderMesh.position.set(cylinderPos.x + dynamicOffset.x, cylinderPos.y + dynamicOffset.y, cylinderPos.z + dynamicOffset.z);
                cylinderMesh.rotation.set(cylinderRot.x, cylinderRot.y, cylinderRot.z);
                cylinderMesh.scale.set(cylinderScale.x, cylinderScale.y, cylinderScale.z);
                cylinderMesh.ID = `cylinder${i}`;
                const sCylinderMesh = await this.GPUScene.add(cylinderMesh);
                const cylinderMat = materialProps;
                sCylinderMesh.GPUMaterial = new GPUMaterialInstance(currentMat);
                sCylinderMesh.GPUMaterial.dynamicAttributes.BaseColor = [0.2, 0.8, 0.3, 1];
                sCylinderMesh.GPUMaterial.dynamicAttributes.Specular = cylinderMat.specular;
                sCylinderMesh.GPUMaterial.dynamicAttributes.Metallic = cylinderMat.metallic;
                sCylinderMesh.GPUMaterial.dynamicAttributes.Roughness = cylinderMat.roughness;
                const sceneCylinderMesh = new SceneStaticMesh(sCylinderMesh);
                sceneCylinderMesh.uuid = sCylinderMesh.uuid;
                sceneCylinderMesh.Position.copy(cylinderMesh.position);
                sceneCylinderMesh.Rotation.copy(cylinderMesh.rotation);
                sceneCylinderMesh.Scale.copy(cylinderMesh.scale);
                filter.AddChild(`cylinder${i}`, sceneCylinderMesh);
            }
        }

        const createPreviewScene = async (material) => {
            const filter = new Filter();
            filter.Name = 'previewObject';
            this.Scene.AddChild('PreviewFilter', filter);
    
            // 创建一个展示平台（使用扁平的圆柱体）
            let platformGeometry = new THREE.CylinderGeometry(5, 5, 0.2, 32);
            platformGeometry = BufferGeometryUtils.mergeVertices(platformGeometry);
            platformGeometry.computeTangents();
            const platformMesh = new THREE.Mesh(platformGeometry);
            platformMesh.position.set(0, 0, 0);  // 放在原点
            platformMesh.updateMatrixWorld(true);
            platformMesh.ID = 'previewPlatform';
            
            const staticPlatformMesh = new StaticMesh(platformMesh, this._ResourceManager);
            staticPlatformMesh.meshID = platformMesh.ID;
            staticPlatformMesh.GPUMaterial = new GPUMaterialInstance(PBRMaterialPavingStones085);
            staticPlatformMesh.GPUMaterial.dynamicAttributes.Specular = 0.9;
            staticPlatformMesh.GPUMaterial.dynamicAttributes.Metallic = 0.9;
            staticPlatformMesh.GPUMaterial.dynamicAttributes.Roughness = 0.1;
            await this.GPUScene.addStaticMesh(staticPlatformMesh);
            
            const scenePlatformMesh = new SceneStaticMesh();
            scenePlatformMesh.uuid = staticPlatformMesh.uuid;
            scenePlatformMesh.Position.copy(platformMesh.position);
            scenePlatformMesh.Rotation.copy(platformMesh.rotation);
            scenePlatformMesh.Scale.copy(platformMesh.scale);
            filter.AddChild('platform', scenePlatformMesh);
    
            // 添加一些预览用的基础几何体
            const geometries = [
                {
                    geometry: new THREE.SphereGeometry(1, 32, 32),
                    position: new THREE.Vector3(-2, 1.5, 0),
                    name: 'previewSphere'
                },
                {
                    geometry: new THREE.BoxGeometry(1.5, 1.5, 1.5),
                    position: new THREE.Vector3(0, 1.5, 0),
                    name: 'previewCube'
                },
                {
                    geometry: new THREE.CylinderGeometry(0.7, 0.7, 2, 32),
                    position: new THREE.Vector3(2, 1.5, 0),
                    name: 'previewCylinder'
                }
            ];
    
            // 创建预览几何体
            for (const item of geometries) {
                const geometry = BufferGeometryUtils.mergeVertices(item.geometry);
                geometry.computeTangents();
                
                const mesh = new THREE.Mesh(geometry);
                mesh.position.copy(item.position);
                mesh.updateMatrixWorld(true);
                mesh.ID = item.name;
                
                const staticMesh = new StaticMesh(mesh, this._ResourceManager);
                staticMesh.meshID = mesh.ID;
                staticMesh.GPUMaterial = new GPUMaterialInstance(material);
                staticMesh.GPUMaterial.dynamicAttributes.BaseColor = [0.7, 0.7, 0.8, 1];
                staticMesh.GPUMaterial.dynamicAttributes.Specular = 0.9;
                staticMesh.GPUMaterial.dynamicAttributes.Metallic = 0.9;
                staticMesh.GPUMaterial.dynamicAttributes.Roughness = 0.1;
                await this.GPUScene.addStaticMesh(staticMesh);
                
                const sceneMesh = new SceneStaticMesh();
                sceneMesh.uuid = staticMesh.uuid;
                sceneMesh.Position.copy(mesh.position);
                sceneMesh.Rotation.copy(mesh.rotation);
                sceneMesh.Scale.copy(mesh.scale);
                filter.AddChild(item.name, sceneMesh);
            }//63,127,253
        };

        // 创建预览场景（使用Metal055A材质）
        await createPreviewScene(PBRMaterialMetal055);
        
        // 创建随机场景（使用原来的材质）
        await createRandomMeshScene(
            [
                PBRMaterialMetal055,
                PBRMaterialFoil002,
                PBRMaterialMetal034,
                PBRMaterialRock017
            ],
            new THREE.Vector3(75, 0, 0)
        );

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
        console.log(PBRMaterialFoil002);
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

        this.Scene.Name = '测试场景';
        const sceneDirectionalLight = new DirectionalLight(this.GPUScene.directLight);
        sceneDirectionalLight.uuid = this.GPUScene.directLight.uuid;
        sceneDirectionalLight.SetLightData(
            this.GPUScene.directLight.params,
            this.GPUScene.directLight.uuid
        );

        this.Scene.AddChild('DirectionalLight', sceneDirectionalLight);

        this.Scene.Update();
    }
}

export default FDeferredShadingSceneRenderer;
