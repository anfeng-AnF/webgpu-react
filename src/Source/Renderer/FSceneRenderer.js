import { MeshBatch } from './Meshbatch/MeshBatch.js';
import { FStaticMesh } from '../Mesh/FStaticMesh';
import { Matrix4, Vector3, Euler, Quaternion, PerspectiveCamera } from 'three';
import FModuleManager from '../Core/FModuleManager';
import FResourceManager from '../Core/Resource/FResourceManager.js';
import { EResourceType } from '../Core/Resource/FResourceManager.js';
import { ResourceConfig } from '../Renderer/InitResource/DeferredRendering/ResourceConfig.js';
import { mat4, vec3 } from 'gl-matrix/mat4';
import ShaderIncluder from '../Core/Shader/ShaderIncluder.js';
import FCopyToCanvasPass from './Pass/FCopyToCanvasPass.js';
import FEarlyZPass from './Pass/FEarlyZPass.js';
import FDeferredRenderingResourceManager from './InitResource/DeferredRendering/FDeferredRenderingResourceManager.js';
import { EMeshType } from '../Mesh/EMeshType';

export class FSceneRenderer {
    constructor(device) {
        this.device = device;
        this.plane = null;
        this.meshes = new Map();
        this.Canvas = null;
        this.context = null;
        this.trianglePipeline = null;
        this.testVertexBuffer = null;
        this.bInitializedCanvas = false;

        // 初始化相机
        this.camera = new PerspectiveCamera(
            60, // FOV
            window.innerWidth / window.innerHeight, // 宽高比
            0.1, // 近平面
            1000 // 远平面
        );

        // 设置相机初始位置和朝向
        this.camera.position.set(0, 10, 20);
        this.camera.lookAt(0, 0, 0);
        this.resourceManager = null;

        // 初始化资源管理器
        this.deferredResourceManager = FDeferredRenderingResourceManager.Initialize(device);

        // 延迟管线的所有pass
        this.passes = new Map();
    }

    /**
     * 创建随机位置和大小的立方体
     * @returns {Array<IMesh>} 生成的网格数组
     */
    CreateRandomCubes(count = 100) {
        const meshes = [];

        for (let i = 0; i < count; i++) {
            // 创建立方体
            const cube = FStaticMesh.CreateCube();

            // 随机长宽高在0.5-3之间
            const scale = new Vector3(
                0.5 + Math.random() * 2.5,
                0.5 + Math.random() * 2.5,
                0.5 + Math.random() * 2.5
            );

            // 随机位置：
            // y轴: 0-20
            // x轴: -20->20
            // z轴: -20->20
            const position = new Vector3(
                -20 + Math.random() * 40,
                Math.random() * 20,
                -20 + Math.random() * 40
            );

            // 随机旋转角度 0-360度
            const rotation = new Euler(
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2
            );
            const quaternion = new Quaternion().setFromEuler(rotation);

            // 构建变换矩阵
            const transform = new Matrix4();
            transform.compose(position, quaternion, scale);

            // 应用变换
            cube.SetTransform(transform.elements);

            meshes.push(cube);
        }

        return meshes;
    }

    /**
     * 初始化场景
     */
    async Initialize() {
        this.resourceManager = FResourceManager.GetInstance();

        // 设置相机到资源管理器
        this.deferredResourceManager.SetCamera(this.camera);

        // 创建100个随机立方体
        this.meshes = this.CreateRandomCubes(100);

        // 创建变换矩阵存储缓冲区
        const transformMatrixs = this.meshes.map((mesh) => mesh.GetTransform());
        const transformStorageBuffer = FResourceManager.GetInstance().CreateResource(
            'MeshTransformBuffer+dynamic',
            {
                Type: EResourceType.Buffer,
                desc: {
                    size: transformMatrixs.length * 16 * 4,
                    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
                    mappedAtCreation: true,
                },
            }
        );
        new Float32Array(transformStorageBuffer.getMappedRange()).set(transformMatrixs.flat());
        transformStorageBuffer.unmap();

        this.MeshBatches = [];
        const EarlyZPassMeshBatch = new MeshBatch(this.meshes, null, EMeshType.Static, "early-z");
        this.MeshBatches.push(EarlyZPassMeshBatch);

        // 更新相机投影矩阵
        this.camera.updateProjectionMatrix();

        const UIModel = FModuleManager.GetInstance().GetModule('UIModule');
        const DetailBuilder = UIModel.GetDetailBuilder();

        // 添加相机属性到 DetailBuilder
        DetailBuilder.addProperties({
            'RendererCamera.Position': {
                value: [this.camera.position.x, this.camera.position.y, this.camera.position.z],
                label: '相机位置',
                type: 'vector3',
                onChange: (path, value) => {
                    this.camera.position.set(value[0], value[1], value[2]);
                    this.camera.updateMatrixWorld();
                    console.log('Camera position updated:', value);
                },
            },
            'RendererCamera.Rotation': {
                value: [
                    this.camera.rotation.x * (180 / Math.PI),
                    this.camera.rotation.y * (180 / Math.PI),
                    this.camera.rotation.z * (180 / Math.PI),
                ],
                label: '相机旋转(度)',
                type: 'vector3',
                onChange: (path, value) => {
                    this.camera.rotation.set(
                        value[0] * (Math.PI / 180),
                        value[1] * (Math.PI / 180),
                        value[2] * (Math.PI / 180)
                    );
                    this.camera.updateMatrixWorld();
                    console.log('Camera rotation updated:', value);
                },
            },
            'RendererCamera.FOV': {
                value: this.camera.fov,
                label: '视野角度',
                type: 'float',
                min: 1,
                max: 179,
                onChange: (path, value) => {
                    this.camera.fov = value;
                    this.camera.updateProjectionMatrix();
                    console.log('Camera FOV updated:', value);
                },
            },
            'RendererCamera.Near': {
                value: this.camera.near,
                label: '近裁面',
                type: 'float',
                min: 0.1,
                max: 100,
                onChange: (path, value) => {
                    this.camera.near = value;
                    this.camera.updateProjectionMatrix();
                    console.log('Camera near plane updated:', value);
                },
            },
            'RendererCamera.Far': {
                value: this.camera.far,
                label: '远裁面',
                type: 'float',
                min: 100,
                max: 10000,
                onChange: (path, value) => {
                    this.camera.far = value;
                    this.camera.updateProjectionMatrix();
                    console.log('Camera far plane updated:', value);
                },
            },
            'RendererCamera.Target': {
                value: [0, 0, 0],
                label: '目标点',
                type: 'vector3',
                onChange: (path, value) => {
                    this.camera.lookAt(value[0], value[1], value[2]);
                    this.camera.updateMatrixWorld();
                    console.log('Camera target updated:', value);
                },
            },
        });
    }

    Render(DeltaTime) {
        if (!this.bInitializedCanvas) {
            return;
        }

        // 更新场景通用数据
        this.deferredResourceManager.UpdateSceneData(DeltaTime);

        // 创建命令编码器
        const commandEncoder = this.device.createCommandEncoder();

        // 使用 get 方法访问 Map 中的 pass
        const earlyZPass = this.passes.get('EarlyZPass');
        const copyToCanvasPass = this.passes.get('CopyToCanvasPass');

        if (!earlyZPass || !copyToCanvasPass) {
            console.warn('Required passes not initialized yet');
            return;
        }

        try {
            // 执行 EarlyZPass
            earlyZPass.Execute(commandEncoder, this.MeshBatches);

            // 获取 EarlyZPass 的输出纹理名称
            const outputTextureName = earlyZPass.GetDefaultOutputTextureName();
            if (!outputTextureName) {
                console.error('EarlyZPass output texture name is null');
                return;
            }

            // 设置深度纹理作为源纹理并执行 CopyToCanvasPass
            copyToCanvasPass.SetSourceTexture(outputTextureName);
            copyToCanvasPass.Execute(commandEncoder);

            // 提交命令
            this.device.queue.submit([commandEncoder.finish()]);
        } catch (error) {
            console.error('Error during render:', error);
        }
    }

    /**
     * 初始化画布
     */
    async InitCanvas(canvas) {
        this.Canvas = canvas;
        this.context = canvas.getContext('webgpu');
        this.context.configure({
            device: this.device,
            format: 'rgba8unorm',
            usage:
                GPUTextureUsage.RENDER_ATTACHMENT |
                GPUTextureUsage.COPY_DST |
                GPUTextureUsage.COPY_SRC,
        });

        // 创建所有的pass
        await this.CreateAllPasses();

        // 更新所有pass的资源
        for (let [key, pass] of this.passes.entries()) {
            try {
                pass.OnCanvasResize(canvas.width, canvas.height, this.context);
            } catch (error) {
                console.error('Error updating pass resources [', key, ']:', error);
            }
        }
        this.bInitializedCanvas = true;
    }

    /**
     * 处理画布尺寸变化
     */
    OnResize(width, height) {
        if (!this.bInitializedCanvas) {
            return;
        }

        // 更新所有pass的资源
        for (let [key, pass] of this.passes.entries()) {
            try {
                pass.OnCanvasResize(width, height, this.context);
            } catch (error) {
                console.error('Error updating pass resources [', key, ']:', error);
            }
        }

        // 更新相机宽高比和相关资源
        this.deferredResourceManager.UpdateCameraAspect(width, height);

        // 更新画布配置
        this.context.configure({
            device: this.device,
            format: 'rgba8unorm',
            usage:
                GPUTextureUsage.RENDER_ATTACHMENT |
                GPUTextureUsage.COPY_SRC |
                GPUTextureUsage.COPY_DST,
        });
    }

    /**
     * 获取相机视图矩阵
     * @returns {Float32Array}
     */
    GetViewMatrix() {
        return this.deferredResourceManager.GetCamera().matrixWorldInverse.elements;
    }

    /**
     * 获取相机投影矩阵
     * @returns {Float32Array}
     */
    GetProjectionMatrix() {
        return this.deferredResourceManager.GetCamera().projectionMatrix.elements;
    }

    /**
     * 获取相机视图投影矩阵
     * @returns {Float32Array}
     */
    GetViewProjectionMatrix() {
        const camera = this.deferredResourceManager.GetCamera();
        const viewProjectionMatrix = new Matrix4();
        viewProjectionMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        return viewProjectionMatrix.elements;
    }

    async CreateAllPasses() {
        try {
            // 创建所有的pass
            this.passes = new Map();  // 确保 Map 被正确初始化
            
            // 创建并初始化 passes
            const earlyZPass = new FEarlyZPass(this.device);
            await earlyZPass.Initialize();
            this.passes.set('EarlyZPass', earlyZPass);

            const copyToCanvasPass = new FCopyToCanvasPass(
                this.context, 
                this.Canvas.width, 
                this.Canvas.height
            );
            await copyToCanvasPass.Initialize();
            this.passes.set('CopyToCanvasPass', copyToCanvasPass);

            console.log('All passes initialized successfully');
        } catch (error) {
            console.error('Error initializing passes:', error);
            throw error;
        }
    }
}
