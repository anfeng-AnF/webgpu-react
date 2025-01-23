import InitDefaultPipeline from '../Renderer/InitResource/DeferredRendering/InitDefaultPipeline';
import { MeshBatch } from './Meshbatch/MeshBatch.js';
import { FStaticMesh } from '../Mesh/FStaticMesh';
import { Matrix4, Vector3, Euler, Quaternion, PerspectiveCamera } from 'three';
import FModuleManager from '../Core/FModuleManager';
import FResourceManager from '../Core/Resource/FResourceManager.js';
import { EResourceType } from '../Core/Resource/FResourceManager.js';
import { ResourceConfig } from '../Renderer/InitResource/DeferredRendering/ResourceConfig.js';
import { mat4, vec3 } from 'gl-matrix/mat4';
import ShaderIncluder from '../Core/Shader/ShaderIncluder.js';
export class FSceneRenderer {
    constructor(device) {

        this.device = device;
        this.plane = null;
        this.meshes = new Map();
        
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
        //初始化基本的渲染资源
        await InitDefaultPipeline.InitializeDeferredRenderPipeline();

        // 创建100个随机立方体
        this.meshes = this.CreateRandomCubes(100);

        // 创建变换矩阵存储缓冲区
        const transformMatrixs = this.meshes.map(mesh => mesh.GetTransform());
        const transformStorageBuffer = FResourceManager.GetInstance().CreateResource(
            'MeshTransformBuffer+dynamic',
            {
                Type: EResourceType.Buffer,
                desc: {
                    size: transformMatrixs.length * 16 * 4,
                    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
                    mappedAtCreation: true
                }
            }
        );
        new Float32Array(transformStorageBuffer.getMappedRange()).set(transformMatrixs.flat());
        transformStorageBuffer.unmap();



        // 更新相机投影矩阵
        this.camera.updateProjectionMatrix();

        const UIModel = FModuleManager.GetInstance().GetModule('UIModule');
        const DetailBuilder = UIModel.GetDetailBuilder();

        // 添加相机属性到 DetailBuilder
        DetailBuilder.addProperties({
            'RendererCamera.Position': {
                value: [
                    this.camera.position.x,
                    this.camera.position.y,
                    this.camera.position.z
                ],
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
                    this.camera.rotation.z * (180 / Math.PI)
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
            }
        });
    }

    Render(DeltaTime) {
        //更新场景数据
        this.UpdateSceneData(DeltaTime);

        //准备渲染资源

    }

    /**
     * 更新场景数据
     * @param {number} deltaTime 帧间隔时间
     */
    UpdateSceneData(deltaTime) {
        const resourceManager = FResourceManager.GetInstance();
        const sceneBuffers = ResourceConfig.GetSceneBuffers();

        // 1. 更新矩阵数据
        const matricesBuffer = resourceManager.GetResource(sceneBuffers.matrices.name);
        if (matricesBuffer) {
            const matrixData = new Float32Array(sceneBuffers.matrices.totalSize / 4);
            
            // 获取相机矩阵
            const view = this.camera.matrixWorldInverse.elements;
            const projection = this.camera.projectionMatrix.elements;
            
            // 计算组合矩阵
            const viewProjection = this.GetViewProjectionMatrix();
            
            // 计算逆矩阵
            const viewInverse = this.camera.matrixWorld.elements;
            const projectionInverse = new Matrix4()
                .copy(this.camera.projectionMatrix)
                .invert()
                .elements;
            const viewProjectionInverse = new Matrix4()
                .fromArray(viewProjection)
                .invert()
                .elements;

            // 按照偏移填充数据
            // 注意：model相关的矩阵会在每个mesh绘制时单独更新
            matrixData.set(view, sceneBuffers.matrices.values.view.offset / 4);
            matrixData.set(projection, sceneBuffers.matrices.values.projection.offset / 4);
            matrixData.set(viewProjection, sceneBuffers.matrices.values.viewProjection.offset / 4);
            matrixData.set(viewInverse, sceneBuffers.matrices.values.viewInverse.offset / 4);
            matrixData.set(projectionInverse, sceneBuffers.matrices.values.projectionInverse.offset / 4);
            matrixData.set(viewProjectionInverse, sceneBuffers.matrices.values.viewProjectionInverse.offset / 4);

            this.device.queue.writeBuffer(matricesBuffer, 0, matrixData);
        }

        // 2. 更新相机属性数据
        const cameraBuffer = resourceManager.GetResource(sceneBuffers.camera.name);
        if (cameraBuffer) {
            const cameraData = new Float32Array(sceneBuffers.camera.totalSize / 4);
            
            // 获取相机数据
            const position = this.camera.position;
            const direction = new Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
            const up = new Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
            const right = new Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);

            // 按照偏移填充数据
            cameraData.set([position.x, position.y, position.z], 
                sceneBuffers.camera.values.position.offset / 4);
            cameraData.set([direction.x, direction.y, direction.z], 
                sceneBuffers.camera.values.direction.offset / 4);
            cameraData.set([up.x, up.y, up.z], 
                sceneBuffers.camera.values.up.offset / 4);
            cameraData.set([right.x, right.y, right.z], 
                sceneBuffers.camera.values.right.offset / 4);
            cameraData.set([this.camera.aspect], 
                sceneBuffers.camera.values.aspect.offset / 4);

            this.device.queue.writeBuffer(cameraBuffer, 0, cameraData);
        }

        // 3. 更新场景参数数据
        const sceneBuffer = resourceManager.GetResource(sceneBuffers.Scene.name);
        if (sceneBuffer) {
            const sceneParamData = new Float32Array(sceneBuffers.Scene.totalSize / 4);
            
            // 设置时间数据
            const currentTime = performance.now() / 1000; // 转换为秒
            sceneParamData.set([currentTime, deltaTime], 
                sceneBuffers.Scene.values.time.offset / 4);

            this.device.queue.writeBuffer(sceneBuffer, 0, sceneParamData);
        }
    }

    /**
     * 初始化画布
     */
    InitCanvas(canvas) {
        InitDefaultPipeline.InitializeDeferredRenderPipelineTextureByCanvas(canvas);
    }

    /**
     * 处理画布尺寸变化
     */
    OnResize(width, height) {
        // 重新创建受Canvas尺寸影响的资源
        InitDefaultPipeline.InitializeDeferredRenderPipelineTextureByCanvasSize(width, height);
    
        // 更新相机宽高比和投影矩阵
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }

    /**
     * 获取相机视图矩阵
     * @returns {Float32Array}
     */
    GetViewMatrix() {
        return this.camera.matrixWorldInverse.elements;
    }

    /**
     * 获取相机投影矩阵
     * @returns {Float32Array}
     */
    GetProjectionMatrix() {
        return this.camera.projectionMatrix.elements;
    }

    /**
     * 获取相机视图投影矩阵
     * @returns {Float32Array}
     */
    GetViewProjectionMatrix() {
        const viewProjectionMatrix = new Matrix4();
        viewProjectionMatrix.multiplyMatrices(
            this.camera.projectionMatrix,
            this.camera.matrixWorldInverse
        );
        return viewProjectionMatrix.elements;
    }
}
