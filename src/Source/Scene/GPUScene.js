import * as THREE from 'three';
import StaticMesh from '../Mesh/StaticMesh.js';
import FResourceManager from '../Core/Resource/FResourceManager.js';
import { createPBRMaterial } from '../Material/Mat_Instance/PBR.js';
import { resourceName } from '../Renderer/DeferredShadingRenderer/ResourceNames.js';

/**
 * GPUScene
 *
 * 管理场景相关的 GPU 资源：
 *   - SceneBuffer：用于摄像机视图、投影、摄像机位置等数据的 uniform buffer
 *   - MeshInfo storage buffer：用于存储每个 Mesh 的 MeshInfo 数据（结构定义见 Shader/Common/MeshInfo.wgsh），
 *     每个 MeshInfo 占用 256 字节，通过 dynamic offset 访问每个 Mesh 的数据。
 *
 * 使用示例：
 *   const gpuScene = new GPUScene(device);
 *   await gpuScene.initBuffers(maxMeshCount);
 *
 *   // 更新 SceneBuffer（sceneData 的大小应匹配缓冲区大小，此处取 256 字节）
 *   gpuScene.updateSceneBuffer(sceneData);
 *
 *   // 为新的 Mesh 分配槽并写入 MeshInfo 数据
 *   const slot = gpuScene.allocateMeshSlot("myMeshID");
 *   if(slot !== -1) {
 *       gpuScene.updateMeshInfo("myMeshID", meshInfoData);
 *   }
 *
 * 注：
 *   - 每个 MeshInfo 固定 256 字节（由 Shader 约定）
 *   - removeMeshSlot 仅删除槽记录，不回收空间，实际应用中可考虑场景重新构建缓冲区
 */
export default class GPUScene extends THREE.Scene {

    /**
     * 构造函数
     */
    constructor() {
        super();
        /**
         * GPU资源管理器实例，用于管理创建和销毁GPU资源
         * @type {FResourceManager}
         */
        this.resourceManager = FResourceManager.GetInstance();

        /**
         * 存储的 GPU Mesh 实例数组（例如 StaticMesh），用于管理场景中的所有 GPU Mesh
         * @type {Array<StaticMesh>}
         */
        this.meshes = [];

        /**
         * SceneBuffer 对应的uniform buffer，
         * 用于存储摄像机视图矩阵、投影矩阵、摄像机位置等数据
         * @type {GPUBuffer|null}
         */
        this.sceneBuffer = null;

        /**
         * MeshInfo storage buffer，用于存储每个 Mesh 的 GPU 信息数据，
         * 如模型矩阵，每个 MeshInfo 占用固定字节数
         * @type {GPUBuffer|null}
         */
        this.meshStorageBuffer = null;

        /**
         * @type {GPUBindGroup}
         */
        this.sceneBindGroup = null;

        /**
         * @type {GPUBindGroupLayout}
         */
        this.sceneBindGroupLayout = null;

        /**
         * 每个 MeshInfo 数据所占用的字节数，
         * 此处设置为 256 字节 因为dynamicOffset 必须 256对齐
         * @type {number}
         */
        this.meshInfoByteSize = 256 * 1;

        /**
         * 初始时不会用 maxMeshes，后续使用 meshCapacity 表示当前缓冲区容量
         * @type {number}
         */
        this.meshCapacity = 0;

        /**
         * 键值对映射，保存 meshID 到存储槽索引的对应关系，
         * 用于动态偏移访问 meshInfo storage buffer 中的每个 Mesh 数据
         * @type {Map<string, number>}
         */
        this.meshSlotMap = new Map();

        /**
         * 当前已分配的 Mesh 数量，
         * 用于确定下一个可用的槽索引
         * @type {number}
         */
        this.currentMeshCount = 0;

        /**
         * 渲染摄像机
         * @type {THREE.Camera}
         */
        this.camera = null;
    }

    /**
     * 重写 THREE.Scene.add 方法
     * 如果添加对象是 THREE.Mesh 则用 StaticMesh 包裹后添加到内部 GPU Mesh 管理列表中，
     * 同时将包裹后的 StaticMesh 添加到 THREE.Scene 中。
     * @param {THREE.Object3D} object - 待添加对象
     * @returns {this,THREE.Object3D} 当前场景实例
     */
    async add(object) {
        if(object instanceof StaticMesh){
            return this.#addStaticMesh(object);
        }
        else if (object instanceof THREE.Mesh) {
            // 使用 object.uuid 作为唯一标识
            const meshID = object.uuid;
          
            // 创建 StaticMesh 包裹对象（确保内部 GPUMaterial 正确）
            const staticMesh = new StaticMesh(object, this.resourceManager);
            // 将唯一标识保存到 staticMesh 对象中
            staticMesh.meshID = meshID;

            return this.#addStaticMesh(staticMesh);
        } else {
            super.add(object);
            return [this,object];
        }
    }

    async #addStaticMesh(staticMesh){
        this.meshes.push(staticMesh);
        this._allocateMeshSlot(staticMesh.meshID);
        await this.updateMeshInfo(staticMesh.meshID);
        super.add(staticMesh);
        return [this,staticMesh];
    }

    /**
     * 重写 THREE.Scene.remove 方法
     * 当对象是 StaticMesh 时，从内部管理列表中移除对应项。
     * @param {THREE.Object3D} object - 待移除对象
     * @returns {this} 当前场景实例
     */
    remove(object) {
        if (object instanceof StaticMesh) {
            // 获取 Mesh 的唯一标识（由 add 时设置）
            const meshID = object.meshID || object.uuid;
            // 自动移除存储槽（私有方法，内部会调整槽顺序并更新被交换 Mesh 的 storage 信息）
            this._removeMeshSlot(meshID);

            const index = this.meshes.indexOf(object);
            if (index !== -1) {
                this.meshes.splice(index, 1);
            }
            return super.remove(object);
        } else {
            return super.remove(object);
        }
    }

    /**
     * 更新场景和SceneBuffer信息
     * @param {number} DeltaTime
     */
    async Update(DeltaTime) {
        await this.updateSceneBuffer(DeltaTime);
        await this.updateAllMeshInfo();
    }

    /**
     * 将全部网格信息上传到GPU
     */
    upLoadMeshToGPU() {
        for (const mesh of this.meshes) {
            mesh.uploadToGPU();
        }
    }

    /**
     * 初始化 SceneBuffer 与 MeshInfo storage buffer
     * @param {number} initialCapacity - 初始容量
     */
    async initBuffers(initialCapacity = 128) {
        this.meshCapacity = initialCapacity;

        // 创建 SceneBuffer uniform buffer
        const sceneBufferSize = 256;
        this.sceneBuffer = this.resourceManager.CreateResource(resourceName.Scene.sceneBuffer, {
            Type: 'Buffer',
            desc: {
                size: sceneBufferSize,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
            },
        });

        // 创建 MeshInfo storage buffer：每个 MeshInfo 固定 256 字节
        const meshStorageBufferSize = this.meshInfoByteSize * this.meshCapacity;
        this.meshStorageBuffer = this.resourceManager.CreateResource(resourceName.Scene.meshStorageBuffer, {
            Type: 'Buffer',
            desc: {
                size: meshStorageBufferSize,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
                mappedAtCreation: false,
            },
        });
        await this.#reCreateSceneBindGroup();
    }

    /**
     * 重新创建 SceneBindGroup
     */
    async #reCreateSceneBindGroup() {
        // 获取 GPU 设备
        const device = await this.resourceManager.GetDevice();
        if (!device) {
            console.error('Device is not available in GPUScene.#reCreateSceneBindGroup');
            return;
        }

        // 创建 BindGroupLayout
        this.sceneBindGroupLayout = this.resourceManager.CreateResource(resourceName.Scene.sceneBindGroupLayout, {
            Type: 'BindGroupLayout',
            desc: {
                entries: [
                    {
                        binding: 0,
                        visibility:
                            GPUShaderStage.VERTEX |
                            GPUShaderStage.FRAGMENT |
                            GPUShaderStage.COMPUTE,
                        buffer: { type: 'uniform' },
                    },
                    {
                        binding: 1,
                        visibility:
                            GPUShaderStage.VERTEX |
                            GPUShaderStage.FRAGMENT |
                            GPUShaderStage.COMPUTE,
                        buffer: { type: 'read-only-storage', hasDynamicOffset: true },
                    },
                ],
            },
        });

        // 使用资源管理器创建 BindGroup
        this.sceneBindGroup = this.resourceManager.CreateResource(resourceName.Scene.sceneBindGroup, {
            Type: 'BindGroup',
            desc: {
                layout: this.sceneBindGroupLayout,
                entries: [
                    {
                        binding: 0,
                        resource: { buffer: this.sceneBuffer },
                    },
                    {
                        binding: 1,
                        resource: {
                            buffer: this.meshStorageBuffer,
                            size: this.meshInfoByteSize, // 每个 MeshInfo 信息大小，将用作 dynamic offset stride
                        },
                    },
                ],
            },
        });

        console.log('SceneBindGroup recreated successfully using FResourceManager.');
    }

    /**
     * 更新 SceneBuffer 数据
     * 根据 Shader 中定义的 SceneBuffer 结构更新：
     * viewMatrix(0-15), projMatrix(16-31), camPos(32-35),
     * camDir(36-39), camUp(40-43), camRight(44-47),
     * timeDelta(48-51)（x = elapsedTime, y = DeltaTime, zw = padding）
     */
    async updateSceneBuffer(DeltaTime) {
        // 创建 sceneData 数组，大小为 sceneBuffer 的大小除以 f32 的字节数
        const sceneData = new Float32Array(this.sceneBuffer.size / Float32Array.BYTES_PER_ELEMENT);

        if (this.camera === null) {
            console.error('GPUScene: camera is not set!');
            return;
        }

        // 维护一个累计时间变量
        if (this.elapsedTime === undefined) {
            this.elapsedTime = 0;
        }
        this.elapsedTime += DeltaTime;

        // 填充 viewMatrix (indices 0-15)
        const viewMatrix = this.camera.matrixWorldInverse.elements;
        sceneData.set(viewMatrix, 0);

        // 填充 projMatrix (indices 16-31)
        const projMatrix = this.camera.projectionMatrix.elements;
        sceneData.set(projMatrix, 16);

        // 填充 camPos (indices 32-35) using camera.position
        sceneData[32] = this.camera.position.x;
        sceneData[33] = this.camera.position.y;
        sceneData[34] = this.camera.position.z;
        sceneData[35] = 0.0; // padding

        // 填充 camDir (indices 36-39) using camera.getWorldDirection()
        const camDir = new THREE.Vector3();
        this.camera.getWorldDirection(camDir);
        sceneData[36] = camDir.x;
        sceneData[37] = camDir.y;
        sceneData[38] = camDir.z;
        sceneData[39] = 0.0; // padding

        // 填充 camUp (indices 40-43) using camera.up
        sceneData[40] = this.camera.up.x;
        sceneData[41] = this.camera.up.y;
        sceneData[42] = this.camera.up.z;
        sceneData[43] = 0.0; // padding

        // 计算并填充 camRight (indices 44-47)
        const right = new THREE.Vector3()
            .setFromMatrixColumn(this.camera.matrixWorld, 0)
            .normalize();
        sceneData[44] = right.x;
        sceneData[45] = right.y;
        sceneData[46] = right.z;
        sceneData[47] = 0.0; // padding

        // 填充 timeDelta (indices 48-51)：x = elapsedTime, y = DeltaTime, z = 0, w = 0
        sceneData[48] = this.elapsedTime;
        sceneData[49] = DeltaTime;
        sceneData[50] = 0.0;
        sceneData[51] = 0.0;

        // 剩余的 indices (52-63) 保持为0（padding）

        // 写入 sceneData 到 sceneBuffer
        const device = await this.resourceManager.GetDevice();
        if (!device) {
            console.error('Device is not available in resourceManager.');
            return;
        }
        device.queue.writeBuffer(this.sceneBuffer, 0, sceneData);
    }

    /**
     * @private
     * 为 Mesh 分配存储槽，如果已满则扩容
     * @param {string} meshID - Mesh 的唯一标识符
     * @returns {number} 返回分配的槽索引
     */
    async _allocateMeshSlot(meshID) {
        if (this.currentMeshCount >= this.meshCapacity) {
            await this._expandMeshStorage(128);
            this.updateAllMeshInfo();
        }

        const slotIndex = this.currentMeshCount;
        this.meshSlotMap.set(meshID, slotIndex);
        this.currentMeshCount++;
        return slotIndex;
    }

    /**
     * @private
     * 扩容 Mesh Storage Buffer
     * @param {number} expansionCount - 本次扩容增加的槽数量
     */
    async _expandMeshStorage(expansionCount) {
        const newCapacity = this.meshCapacity + expansionCount;
        console.log(`Expanding mesh storage buffer from ${this.meshCapacity} to ${newCapacity}`);
        const meshStorageBufferSize = this.meshInfoByteSize * newCapacity;
        this.meshStorageBuffer = this.resourceManager.CreateResource(resourceName.Scene.meshStorageBuffer, {
            Type: 'Buffer',
            desc: {
                size: meshStorageBufferSize,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
                mappedAtCreation: false,
            },
        });
        await this.#reCreateSceneBindGroup();
        this.meshCapacity = newCapacity;
    }

    /**
     * 更新指定 Mesh 的 MeshInfo 数据到 storage buffer 中
     * @param {string} meshID - Mesh 的唯一标识符
     */
    async updateMeshInfo(meshID) {
        const slotIndex = this.meshSlotMap.get(meshID);
        if (slotIndex === undefined) {
            console.error('MeshID not allocated in GPUScene:', meshID);
            return;
        }

        const mesh = this.meshes[slotIndex];
        const meshInfoData = new Float32Array(this.meshInfoByteSize / 4);
        const modelMatrix = mesh.modelMatrix || mesh.matrixWorld;
        if (!modelMatrix) {
            console.error('Mesh has no modelMatrix or matrixWorld property.');
            return;
        }
        meshInfoData.set(modelMatrix.elements, 0);

        const materialInfo = mesh.getMaterialInfo();
        if(materialInfo.length > 0){
            meshInfoData.set(materialInfo, 16); // 写入 materialInfo（从偏移16 floats，即64 字节处）
        }

        const offset = slotIndex * this.meshInfoByteSize;
        const device = await this.resourceManager.GetDevice();
        if (!device) {
            console.error('Device is not available in resourceManager.');
            return;
        }
        device.queue.writeBuffer(this.meshStorageBuffer, offset, meshInfoData);
    }

    /**
     * @private
     * 移除 Mesh 的存储槽并更新后续 Mesh 的 slot 排序，
     * 同时在交换后自动更新被交换 Mesh 在 storage 中的 MeshInfo 信息。
     * @param {string} meshID - Mesh 的唯一标识符
     */
    _removeMeshSlot(meshID) {
        const slotIndex = this.meshSlotMap.get(meshID);
        if (slotIndex === undefined) {
            console.error('MeshID not found in GPUScene:', meshID);
            return;
        }

        const lastIndex = this.currentMeshCount - 1;

        // 如果移除的 Mesh 不是最后一个，则进行交换
        if (slotIndex !== lastIndex) {
            const swappedMesh = this.meshes[lastIndex];
            let swappedMeshId = null;
            for (const [id, index] of this.meshSlotMap.entries()) {
                if (index === lastIndex) {
                    swappedMeshId = id;
                    break;
                }
            }
            // 将最后一个 Mesh 填补到删除位置
            this.meshes[slotIndex] = swappedMesh;
            // 更新映射信息
            if (swappedMeshId) {
                this.meshSlotMap.set(swappedMeshId, slotIndex);
                // 异步更新交换后 Mesh 的 MeshInfo 信息（fire and forget）
                this.updateMeshInfo(swappedMeshId);
            }
        }

        // 移除最后一个元素和被删除的映射
        this.meshes.pop();
        this.meshSlotMap.delete(meshID);
        this.currentMeshCount--;
    }

    /**
     * 更新所有 MeshInfo storage 数据，一次性写入所有 Mesh 的信息到 GPU
     */
    async updateAllMeshInfo() {
        const count = this.currentMeshCount;
        const floatsPerMesh = this.meshInfoByteSize / Float32Array.BYTES_PER_ELEMENT;
        const totalFloats = count * floatsPerMesh;
        const allMeshInfo = new Float32Array(totalFloats);

        for (let i = 0; i < count; i++) {
            const mesh = this.meshes[i];
            const infoOffset = i * floatsPerMesh;

            const modelMatrix = mesh.matrixWorld;
            if (!modelMatrix) {
                console.error('Mesh has no modelMatrix or matrixWorld property:', mesh);
                continue;
            }
            // 写入 modelMatrix (前 16 floats)
            allMeshInfo.set(modelMatrix.elements, infoOffset);

            // 获取材质信息（假定 getMaterialInfo 返回的数组长度适合放到剩余位置）
            let gpuMaterial = await mesh.GPUMaterial;
            const materialInfo = gpuMaterial.getMaterialInfo();
            // 写入 materialInfo，从第 16 个元素开始（偏移 16 floats，即64 字节）
            allMeshInfo.set(materialInfo, infoOffset + 16);
        }

        const device = await this.resourceManager.GetDevice();
        if (!device) {
            console.error('Device is not available in resourceManager.');
            return;
        }
        // 一次性将所有 Mesh 信息写入 storage buffer，从偏移 0 开始
        device.queue.writeBuffer(this.meshStorageBuffer, 0, allMeshInfo);
    }

    /**
     * 获取Mesh的Offset
     * @param {string} meshID - Mesh 的唯一标识符
     * @returns {number} 返回 Mesh 的 offset
     */
    getMeshOffset(meshID) {
        const slotIndex = this.meshSlotMap.get(meshID);
        if (slotIndex === undefined) {
            console.error('MeshID not allocated in GPUScene:', meshID);
            return -1;
        }
        return slotIndex * this.meshInfoByteSize;
    }

    /**
     * 获取所有mesh
     * @returns {Array<StaticMesh>}
     */
    GetAllMesh(){
        return this.meshes;
    }

    /**
     * Debug：读取指定 Mesh 的 MeshInfo 数据，并打印输出到控制台
     * @param {string} meshID - Mesh 的唯一标识符
     */
    async debugCheckMeshInfo(meshID) {
        const offset = this.getMeshOffset(meshID);
        const size = this.meshInfoByteSize;
        const device = await this.resourceManager.GetDevice();

        // 创建一个目标缓冲区方便从 GPU 读取数据
        const stagingBuffer = device.createBuffer({
            size: size,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        });

        // 使用命令编码器复制 meshStorageBuffer 内对应区域的数据到 stagingBuffer
        const commandEncoder = device.createCommandEncoder();
        commandEncoder.copyBufferToBuffer(this.meshStorageBuffer, offset, stagingBuffer, 0, size);
        const commandBuffer = commandEncoder.finish();
        device.queue.submit([commandBuffer]);

        // 异步映射 stagingBuffer，读取数据
        await stagingBuffer.mapAsync(GPUMapMode.READ);
        const arrayBuffer = stagingBuffer.getMappedRange();
        const data = new Float32Array(arrayBuffer);
        // 取前 16 个 float 作为 ModelMatrix
        const modelMatrix = data.slice(0, 16);
        console.log(`Debug ModelMatrix for mesh ${meshID} at offset ${offset}:`, modelMatrix,'\ndata',data.slice(16,64));
        stagingBuffer.unmap();
    }

    /**
     * Debug：读取并打印 SceneBuffer 信息，根据 struct SceneBuffer 定义
     */
    async debugCheckSceneBuffer() {
        // sceneBuffer 应该已经创建，且大小为已分配大小（例如256字节）
        const sceneBufferSize = this.sceneBuffer.size;
        const device = await this.resourceManager.GetDevice();
        
        // 创建一个 staging buffer 用于读取 sceneBuffer 数据
        const stagingBuffer = device.createBuffer({
            size: sceneBufferSize,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        });

        // 使用命令编码器将 sceneBuffer 中所有数据复制到 stagingBuffer
        const commandEncoder = device.createCommandEncoder();
        commandEncoder.copyBufferToBuffer(this.sceneBuffer, 0, stagingBuffer, 0, sceneBufferSize);
        const commandBuffer = commandEncoder.finish();
        device.queue.submit([commandBuffer]);

        // 异步映射 stagingBuffer 进行读取
        await stagingBuffer.mapAsync(GPUMapMode.READ);
        const arrayBuffer = stagingBuffer.getMappedRange();
        const data = new Float32Array(arrayBuffer);

        // 根据 struct SceneBuffer 定义，共含 7 个字段
        // viewMatrix: 16 floats, projMatrix: 16 floats,
        // camPos: 4 floats, camDir: 4 floats, camUp: 4 floats,
        // camRight: 4 floats, timeDelta: 4 floats.
        const viewMatrix = data.slice(0, 16);
        const projMatrix = data.slice(16, 32);
        const camPos = data.slice(32, 36);
        const camDir = data.slice(36, 40);
        const camUp = data.slice(40, 44);
        const camRight = data.slice(44, 48);
        const timeDelta = data.slice(48, 52);

        console.log("SceneBuffer Debug Information:");
        console.log("ViewMatrix:", viewMatrix);
        console.log("ProjMatrix:", projMatrix);
        console.log("CamPos:", camPos);
        console.log("CamDir:", camDir);
        console.log("CamUp:", camUp);
        console.log("CamRight:", camRight);
        console.log("TimeDelta:", timeDelta);

        stagingBuffer.unmap();
    }
}
