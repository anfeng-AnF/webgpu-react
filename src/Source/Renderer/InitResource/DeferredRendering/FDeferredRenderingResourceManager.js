import { Matrix4, Vector3 } from 'three';
import FResourceManager from '../../../Core/Resource/FResourceManager.js';
import { EResourceType } from '../../../Core/Resource/FResourceManager.js';
import { ResourceConfig } from './ResourceConfig.js';

/**
 * 延迟渲染资源管理器
 * 负责管理和更新延迟渲染所需的各种资源
 */
class FDeferredRenderingResourceManager {
    static #instance = null;
    #device;
    #resourceManager;
    #camera = null;  // 添加相机引用

    constructor(device) {
        this.#device = device;
        this.#resourceManager = FResourceManager.GetInstance();
    }

    static Initialize(device) {
        if (!this.#instance) {
            this.#instance = new FDeferredRenderingResourceManager(device);
            this.#instance.CreateSceneBuffers();  // 创建场景缓冲区
        }
        return this.#instance;
    }

    /**
     *
     * @returns {FDeferredRenderingResourceManager}
     * @constructor
     */
    static GetInstance() {
        return this.#instance;
    }

    /**
     * 设置渲染相机
     * @param {PerspectiveCamera} camera 相机实例
     * @param {boolean} [updateProjection=true] 是否更新投影矩阵
     */
    SetCamera(camera, updateProjection = true) {
        this.#camera = camera;

        if (updateProjection) {
            // 更新相机投影矩阵
            this.#camera.updateProjectionMatrix();
        }

        // 更新相机相关的资源
        const sceneBuffers = ResourceConfig.GetSceneBuffers();
        
        // 更新矩阵数据
        this.#updateMatricesBuffer(this.#camera, sceneBuffers);
        
        // 更新相机属性数据
        this.#updateCameraBuffer(this.#camera, sceneBuffers);
    }

    /**
     * 获取当前相机实例
     * @returns {PerspectiveCamera|null} 当前相机实例
     */
    GetCamera() {
        return this.#camera;
    }

    /**
     * 更新相机宽高比
     * @param {number} width 视口宽度
     * @param {number} height 视口高度
     */
    UpdateCameraAspect(width, height) {
        if (this.#camera) {
            this.#camera.aspect = width / height;
            this.#camera.updateProjectionMatrix();
            
            // 更新相机相关的资源
            this.SetCamera(this.#camera, false); // 不需要再次更新投影矩阵
        }
    }

    /**
     * 更新场景通用数据（相机、时间等）
     * @param {number} deltaTime 帧间隔时间
     * @param {boolean} [updateMatrices=true] 是否更新矩阵
     */
    UpdateSceneData(deltaTime, updateMatrices = true) {
        if (!this.#camera) {
            console.warn('DeferredRenderingResourceManager: Camera not set');
            return;
        }

        const sceneBuffers = ResourceConfig.GetSceneBuffers();

        // 1. 更新矩阵数据（如果需要）
        if (updateMatrices) {
            this.#updateMatricesBuffer(this.#camera, sceneBuffers);
        }

        // 2. 更新相机属性数据
        this.#updateCameraBuffer(this.#camera, sceneBuffers);

        // 3. 更新场景参数数据
        this.#updateSceneBuffer(deltaTime, sceneBuffers);
    }

    /**
     * 更新模块的矩阵数据
     * @param {Float32Array} moduleMatrix 模块的变换矩阵
     * @returns {GPUBuffer} 更新后的矩阵缓冲区
     */
    UpdateModuleMatrices(moduleMatrix) {
        if (!this.#camera) {
            console.warn('DeferredRenderingResourceManager: Camera not set');
            return null;
        }

        return this.#updateModuleMatrices(this.#camera, moduleMatrix);
    }

    // 将原来的 UpdateModuleMatrices 改名为私有方法
    #updateModuleMatrices(camera, moduleMatrix) {
        const sceneBuffers = ResourceConfig.GetSceneBuffers();

        // 获取相机矩阵
        const view = camera.matrixWorldInverse.elements;
        const viewInverse = camera.matrixWorld.elements;
        const projection = camera.projectionMatrix.elements;
        const projectionInverse = new Matrix4()
            .copy(camera.projectionMatrix)
            .invert()
            .elements;

        // 计算模型矩阵的逆矩阵
        const modelInverse = new Matrix4()
            .fromArray(moduleMatrix)
            .invert()
            .elements;

        // 获取已存在的矩阵缓冲区
        const matricesBuffer = this.#resourceManager.GetResource(sceneBuffers.matrices.name);
        if (!matricesBuffer) {
            console.error('Matrices buffer not found');
            return null;
        }

        // 创建矩阵数据数组
        const matrixData = new Float32Array(sceneBuffers.matrices.totalSize / 4);

        // 按照新的偏移填充数据
        matrixData.set(moduleMatrix, sceneBuffers.matrices.values.model.offset / 4);
        matrixData.set(modelInverse, sceneBuffers.matrices.values.modelInverse.offset / 4);
        matrixData.set(view, sceneBuffers.matrices.values.view.offset / 4);
        matrixData.set(viewInverse, sceneBuffers.matrices.values.viewInverse.offset / 4);
        matrixData.set(projection, sceneBuffers.matrices.values.projection.offset / 4);
        matrixData.set(projectionInverse, sceneBuffers.matrices.values.projectionInverse.offset / 4);

        // 写入缓冲区
        this.#device.queue.writeBuffer(matricesBuffer, 0, matrixData);

        return matricesBuffer;
    }

    // 私有辅助方法
    #updateMatricesBuffer(camera, sceneBuffers) {
        const matricesBuffer = this.#resourceManager.GetResource(sceneBuffers.matrices.name);
        if (matricesBuffer) {
            const matrixData = new Float32Array(sceneBuffers.matrices.totalSize / 4);

            // 获取相机矩阵
            const view = camera.matrixWorldInverse.elements;
            const viewInverse = camera.matrixWorld.elements;
            const projection = camera.projectionMatrix.elements;
            const projectionInverse = new Matrix4()
                .copy(camera.projectionMatrix)
                .invert()
                .elements;

            // 使用单位矩阵作为默认的模型矩阵
            const model = new Matrix4().elements;
            const modelInverse = new Matrix4().elements;

            // 按照新的偏移填充数据
            matrixData.set(model, sceneBuffers.matrices.values.model.offset / 4);
            matrixData.set(modelInverse, sceneBuffers.matrices.values.modelInverse.offset / 4);
            matrixData.set(view, sceneBuffers.matrices.values.view.offset / 4);
            matrixData.set(viewInverse, sceneBuffers.matrices.values.viewInverse.offset / 4);
            matrixData.set(projection, sceneBuffers.matrices.values.projection.offset / 4);
            matrixData.set(projectionInverse, sceneBuffers.matrices.values.projectionInverse.offset / 4);

            this.#device.queue.writeBuffer(matricesBuffer, 0, matrixData);
        }
    }

    #updateCameraBuffer(camera, sceneBuffers) {
        const cameraBuffer = this.#resourceManager.GetResource(sceneBuffers.camera.name);
        if (cameraBuffer) {
            const cameraData = new Float32Array(sceneBuffers.camera.totalSize / 4);

            // 获取相机数据
            const position = camera.position;
            const direction = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            const up = new Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
            const right = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion);

            // 按照偏移填充数据
            cameraData.set([position.x, position.y, position.z], sceneBuffers.camera.values.position.offset / 4);
            cameraData.set([direction.x, direction.y, direction.z], sceneBuffers.camera.values.direction.offset / 4);
            cameraData.set([up.x, up.y, up.z], sceneBuffers.camera.values.up.offset / 4);
            cameraData.set([right.x, right.y, right.z], sceneBuffers.camera.values.right.offset / 4);
            cameraData.set([camera.aspect], sceneBuffers.camera.values.aspect.offset / 4);

            this.#device.queue.writeBuffer(cameraBuffer, 0, cameraData);
        }
    }

    #updateSceneBuffer(deltaTime, sceneBuffers) {
        const sceneBuffer = this.#resourceManager.GetResource(sceneBuffers.Scene.name);
        if (sceneBuffer) {
            const sceneParamData = new Float32Array(sceneBuffers.Scene.totalSize / 4);

            // 设置时间数据
            const currentTime = performance.now() / 1000;
            sceneParamData.set([currentTime, deltaTime], sceneBuffers.Scene.values.time.offset / 4);

            this.#device.queue.writeBuffer(sceneBuffer, 0, sceneParamData);
        }
    }

    #getViewProjectionMatrix(camera) {
        const viewProjectionMatrix = new Matrix4();
        viewProjectionMatrix.multiplyMatrices(
            camera.projectionMatrix,
            camera.matrixWorldInverse
        );
        return viewProjectionMatrix.elements;
    }

    /**
     * 创建场景所需的缓冲区资源
     */
    CreateSceneBuffers() {
        const sceneBuffers = ResourceConfig.GetSceneBuffers();

        // 1. 创建矩阵缓冲区
        this.#resourceManager.CreateResource(
            sceneBuffers.matrices.name,
            {
                Type: EResourceType.Buffer,
                desc: {
                    size: sceneBuffers.matrices.totalSize,
                    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
                    mappedAtCreation: false
                }
            }
        );

        // 2. 创建相机属性缓冲区
        this.#resourceManager.CreateResource(
            sceneBuffers.camera.name,
            {
                Type: EResourceType.Buffer,
                desc: {
                    size: sceneBuffers.camera.totalSize,
                    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
                    mappedAtCreation: false
                }
            }
        );

        // 3. 创建场景参数缓冲区
        this.#resourceManager.CreateResource(
            sceneBuffers.Scene.name,
            {
                Type: EResourceType.Buffer,
                desc: {
                    size: sceneBuffers.Scene.totalSize,
                    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
                    mappedAtCreation: false
                }
            }
        );

        // 4. 创建绑定组布局
        this.#resourceManager.CreateResource(
            sceneBuffers.layoutName,
            {
                Type: EResourceType.BindGroupLayout,
                desc: {
                    entries: [
                        {
                            binding: 0,
                            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                            buffer: { type: 'uniform' }  // 矩阵缓冲区
                        },
                        {
                            binding: 1,
                            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                            buffer: { type: 'uniform' }  // 相机属性缓冲区
                        },
                        {
                            binding: 2,
                            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                            buffer: { type: 'uniform' }  // 场景参数缓冲区
                        }
                    ]
                }
            }
        );

        // 5. 创建绑定组
        this.#resourceManager.CreateResource(
            sceneBuffers.name,
            {
                Type: EResourceType.BindGroup,
                desc: {
                    layout: this.#resourceManager.GetResource(sceneBuffers.layoutName),
                    entries: [
                        {
                            binding: 0,
                            resource: {
                                buffer: this.#resourceManager.GetResource(sceneBuffers.matrices.name)
                            }
                        },
                        {
                            binding: 1,
                            resource: {
                                buffer: this.#resourceManager.GetResource(sceneBuffers.camera.name)
                            }
                        },
                        {
                            binding: 2,
                            resource: {
                                buffer: this.#resourceManager.GetResource(sceneBuffers.Scene.name)
                            }
                        }
                    ]
                }
            }
        );
    }

    /**
     * 销毁场景缓冲区资源
     */
    DestroySceneBuffers() {
        const sceneBuffers = ResourceConfig.GetSceneBuffers();
        
        // 按照创建的相反顺序销毁资源
        const resourceNames = [
            sceneBuffers.name,              // BindGroup
            sceneBuffers.layoutName,        // BindGroupLayout
            sceneBuffers.Scene.name,        // Scene Buffer
            sceneBuffers.camera.name,       // Camera Buffer
            sceneBuffers.matrices.name      // Matrices Buffer
        ];

        for (const name of resourceNames) {
            if (this.#resourceManager.HasResource(name)) {
                this.#resourceManager.DeleteResource(name);
            }
        }
    }

    /**
     * 重新创建场景缓冲区资源
     */
    RecreateSceneBuffers() {
        this.DestroySceneBuffers();
        this.CreateSceneBuffers();
    }

    /**
     * 获取SceneBuffer的GPU BIndgroup
     */
    GetSceneBindgroup(){
        return this.#resourceManager.GetResource(ResourceConfig.GetSceneBuffers().name);
    }
}

export default FDeferredRenderingResourceManager;
