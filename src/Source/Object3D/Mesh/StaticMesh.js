import * as THREE from 'three';
import IGPUMesh from './IGPUMesh.js';
import { createPBRMaterial } from '../../Material/Mat_Instance/PBR.js';




/**
 * StaticMesh
 * 实现 IGPUMesh 接口的具体类，同时继承自 THREE.Mesh 用于与 Three.js 整合，
 * 用于管理静态 Mesh 的 GPU 资源，包括顶点和索引缓冲区的上传、更新和销毁。
 * @extends {THREE.Mesh}
 * @implements {IGPUMesh}
 */
export default class StaticMesh extends THREE.Mesh {
    /**
     * 顶点缓冲区Desc
     * @type {JSON}
     */
    static VertexBufferDesc = {
        arrayStride: 68, // Position(12) + Normal(12) + Tangent(12) + UV0(8) + UV1(8) + UV2(8) + UV3(8)
        attributes: [
            {
                shaderLocation: 0,
                offset: 0,
                format: 'float32x3', // Position
            },
            {
                shaderLocation: 1,
                offset: 12,
                format: 'float32x3', // Normal
            },
            {
                shaderLocation: 2,
                offset: 24,
                format: 'float32x3', // Tangent
            },
            {
                shaderLocation: 3,
                offset: 36,
                format: 'float32x2', // UV0
            },
            {
                shaderLocation: 4,
                offset: 44,
                format: 'float32x2', // UV1
            },
            {
                shaderLocation: 5,
                offset: 52,
                format: 'float32x2', // UV2
            },
            {
                shaderLocation: 6,
                offset: 60,
                format: 'float32x2', // UV3
            },
        ],
    };

    /**
     *
     * @param {THREE.Mesh} mesh 已有的 THREE.Mesh 对象
     * @param {FResourceManager} resourceManager GPU 资源管理器实例
     */
    constructor(mesh, resourceManager) {
        super(mesh.geometry);

        // 复制传入mesh的变换信息，确保StaticMesh具有正确的世界矩阵
        this.position.copy(mesh.position);
        this.rotation.copy(mesh.rotation);
        this.scale.copy(mesh.scale);
        // 更新本身的局部和世界矩阵
        this.updateMatrix();
        // 使用原始mesh更新后世界矩阵
        mesh.updateMatrixWorld(true);
        this.matrixWorld.copy(mesh.matrixWorld);

        /**
         * @type {GPUMaterialInstance}
         */
        this.GPUMaterial = null;
        this.ResourceManager = resourceManager;

        // 使用 mesh 自身的 id 生成资源名称
        this._vertexBufferName = `${this.id}_Buffer_VERTEX`;
        this._indexBufferName = `${this.id}_Buffer_INDEX`;
    }

    /**
     * 获取材质信息 （用于写入 MeshInfo 中）
     * @returns {Float32Array} 材质信息
     */
    getMaterialInfo(){
        if(this.GPUMaterial){
            return this.GPUMaterial.getMaterialInfo();
        }
        return new Float32Array(0);
    }

    /**
     * 设置材质
     * @param {GPUMaterialInstance} GPUMaterialInstance 材质实例
     */
    setMaterial(GPUMaterialInstance){
        if(GPUMaterialInstance instanceof GPUMaterialInstance){
            this.GPUMaterial = GPUMaterialInstance;
        }
        else{
            throw new Error('GPUMaterialInstance must be an instance of GPUMaterialInstance, current type is ' + typeof GPUMaterialInstance);
        }
    }

    /**
     * 创建顶点和索引缓冲区，并上传数据到 GPU。
     */
    async createBuffers() {
        // 从几何体中直接提取顶点和索引数据
        const geometry = this.geometry;
        let vertexDataFromGeometry = null;
        if (geometry.attributes && geometry.attributes.position) {
            vertexDataFromGeometry = {
                position: geometry.attributes.position.array,
                normal: geometry.attributes.normal ? geometry.attributes.normal.array : null,
                tangent: geometry.attributes.tangent ? geometry.attributes.tangent.array : null,
                uv0: geometry.attributes.uv ? geometry.attributes.uv.array : null,
                uv1: geometry.attributes.uv1 ? geometry.attributes.uv1.array : null,
                uv2: geometry.attributes.uv2 ? geometry.attributes.uv2.array : null,
                uv3: geometry.attributes.uv3 ? geometry.attributes.uv3.array : null,
            };
        }

        // 对顶点数据进行归一化，确保统一顶点结构（17 个 float）
        const normalizedVertexData = this.normalizeVertexData(vertexDataFromGeometry);

        let indexDataFromGeometry = null;
        if (geometry.index) {
            indexDataFromGeometry = geometry.index.array;
        }

        // 使用资源管理器创建 GPU 缓冲区
        const device = await this.ResourceManager.GetDevice();

        // 创建 staging buffer 用于写入顶点数据
        const vertexStagingBuffer = device.createBuffer({
            size: normalizedVertexData.byteLength,
            usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC,
            mappedAtCreation: true,
        });
        {
            const mapping = vertexStagingBuffer.getMappedRange();
            new Float32Array(mapping).set(normalizedVertexData);
            vertexStagingBuffer.unmap();
        }

        // 创建最终 GPUVertexBuffer，仅包含真正需要的用途
        this.GPUVertexBuffer = this.ResourceManager.CreateResource(this._vertexBufferName, {
            Type: 'Buffer',
            desc: {
                size: normalizedVertexData.byteLength,
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            }
        });

        // 将 staging buffer 中的数据拷贝到最终的 Vertex Buffer 中
        {
            const commandEncoder = device.createCommandEncoder();
            commandEncoder.copyBufferToBuffer(
                vertexStagingBuffer, 0,
                this.GPUVertexBuffer, 0,
                normalizedVertexData.byteLength
            );
            const commandBuffer = commandEncoder.finish();
            device.queue.submit([commandBuffer]);
        }

        // 创建 staging buffer 用于写入索引数据
        const indexStagingBuffer = device.createBuffer({
            size: indexDataFromGeometry.byteLength,
            usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC,
            mappedAtCreation: true,
        });
        {
            const mapping = indexStagingBuffer.getMappedRange();
            new Uint16Array(mapping).set(indexDataFromGeometry);
            indexStagingBuffer.unmap();
        }

        // 创建最终 GPUIndexBuffer，仅用于 INDEX + COPY_DST（用于拷贝）
        this.GPUIndexBuffer = this.ResourceManager.CreateResource(this._indexBufferName, {
            Type: 'Buffer',
            desc: {
                size: indexDataFromGeometry.byteLength,
                usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
            }
        });

        // 拷贝 staging buffer 数据到最终的 Index Buffer
        {
            const commandEncoder = device.createCommandEncoder();
            commandEncoder.copyBufferToBuffer(
                indexStagingBuffer, 0,
                this.GPUIndexBuffer, 0,
                indexDataFromGeometry.byteLength
            );
            const commandBuffer = commandEncoder.finish();
            device.queue.submit([commandBuffer]);
        }
    }

    /**
     * 更新 GPU 缓冲区数据。
     * 目前实现为先释放，再重新创建缓冲区，可以根据实际需求改进为更高效的更新逻辑。
     */
    updateBuffers() {
        this.destroyBuffers();
        this.createBuffers();
    }

    /**
     * 实现 IGPUMesh 接口方法，将 Mesh 数据上传到 GPU。
     */
    uploadToGPU() {
        this.createBuffers();
        // 如有需要，可扩展更多上传逻辑，例如材质等数据上传
    }

    /**
     * 销毁顶点和索引缓冲区资源，通过资源管理器调用释放方法，
     * 并置空对应引用，确保资源及时释放。
     */
    destroyBuffers() {
        if (this.GPUVertexBuffer) {
            this.ResourceManager.DeleteResource(this._vertexBufferName);
            this.GPUVertexBuffer = null;
        }
        if (this.GPUIndexBuffer) {
            this.ResourceManager.DeleteResource(this._indexBufferName);
            this.GPUIndexBuffer = null;
        }
    }

    /**
     * 实现 IGPUMesh 接口方法，释放所有与 Mesh 相关的 GPU 资源。
     */
    destroy() {
        this.destroyBuffers();
    }

    /**
     * 根据预定义的顶点布局（17 个 float：位置(3), 法向(3), 切线(3), UV0(2), UV1(2), UV2(2), UV3(2)），归一化顶点数据。
     * 如果传入的 vertexData 对象中缺少某个属性，则相应部分填充 0。
     * 
     * 预期输入的 vertexData 为一个对象，例如：
     * {
     *     position: Float32Array, // 必须存在，3 个分量
     *     normal: Float32Array,   // 可选，3 个分量
     *     tangent: Float32Array,  // 可选，3 个分量
     *     uv0: Float32Array,      // 可选，2 个分量
     *     uv1: Float32Array,      // 可选，2 个分量
     *     uv2: Float32Array,      // 可选，2 个分量
     *     uv3: Float32Array       // 可选，2 个分量
     * }
     * 如果 vertexData 不是对象或者没有 position，则直接返回原始数据。
     * 
     * @param {Object|ArrayBuffer|TypedArray} vertexData
     * @returns {Float32Array}
     */
    normalizeVertexData(vertexData) {
        if (vertexData && vertexData.position) {
            const position = vertexData.position;
            const vertexCount = position.length / 3;
            const normalized = new Float32Array(vertexCount * 17);
            for (let i = 0; i < vertexCount; i++) {
                // Position (3 floats)
                normalized[i * 17 + 0] = position[i * 3 + 0];
                normalized[i * 17 + 1] = position[i * 3 + 1];
                normalized[i * 17 + 2] = position[i * 3 + 2];
                // Normal (3 floats) 或填充 0
                if (vertexData.normal && vertexData.normal.length >= (i + 1) * 3) {
                    normalized[i * 17 + 3] = vertexData.normal[i * 3 + 0];
                    normalized[i * 17 + 4] = vertexData.normal[i * 3 + 1];
                    normalized[i * 17 + 5] = vertexData.normal[i * 3 + 2];
                } else {
                    normalized[i * 17 + 3] = 0;
                    normalized[i * 17 + 4] = 0;
                    normalized[i * 17 + 5] = 0;
                }
                // Tangent (3 floats) 或填充 0
                if (vertexData.tangent && vertexData.tangent.length >= (i + 1) * 3) {
                    normalized[i * 17 + 6] = vertexData.tangent[i * 3 + 0];
                    normalized[i * 17 + 7] = vertexData.tangent[i * 3 + 1];
                    normalized[i * 17 + 8] = vertexData.tangent[i * 3 + 2];
                } else {
                    normalized[i * 17 + 6] = 0;
                    normalized[i * 17 + 7] = 0;
                    normalized[i * 17 + 8] = 0;
                }
                // UV0 (2 floats) 或填充 0
                if (vertexData.uv0 && vertexData.uv0.length >= (i + 1) * 2) {
                    normalized[i * 17 + 9] = vertexData.uv0[i * 2 + 0];
                    normalized[i * 17 + 10] = vertexData.uv0[i * 2 + 1];
                } else {
                    normalized[i * 17 + 9] = 0;
                    normalized[i * 17 + 10] = 0;
                }
                // UV1 (2 floats) 或填充 0
                if (vertexData.uv1 && vertexData.uv1.length >= (i + 1) * 2) {
                    normalized[i * 17 + 11] = vertexData.uv1[i * 2 + 0];
                    normalized[i * 17 + 12] = vertexData.uv1[i * 2 + 1];
                } else {
                    normalized[i * 17 + 11] = 0;
                    normalized[i * 17 + 12] = 0;
                }
                // UV2 (2 floats) 或填充 0
                if (vertexData.uv2 && vertexData.uv2.length >= (i + 1) * 2) {
                    normalized[i * 17 + 13] = vertexData.uv2[i * 2 + 0];
                    normalized[i * 17 + 14] = vertexData.uv2[i * 2 + 1];
                } else {
                    normalized[i * 17 + 13] = 0;
                    normalized[i * 17 + 14] = 0;
                }
                // UV3 (2 floats) 或填充 0
                if (vertexData.uv3 && vertexData.uv3.length >= (i + 1) * 2) {
                    normalized[i * 17 + 15] = vertexData.uv3[i * 2 + 0];
                    normalized[i * 17 + 16] = vertexData.uv3[i * 2 + 1];
                } else {
                    normalized[i * 17 + 15] = 0;
                    normalized[i * 17 + 16] = 0;
                }
            }
            return normalized;
        }
        // 若 vertexData 不是对象或不包含 position，则直接返回传入的值
        return vertexData;
    }

}

