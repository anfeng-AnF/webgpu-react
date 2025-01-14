import { FVertexBuffer, EVertexFormat } from './FVertexBuffer';

/**
 * 骨骼网格顶点数据结构
 * @typedef {Object} SkeletalMeshVertex
 * @property {Float32Array} position - 位置 (xyz)
 * @property {Float32Array} normal - 法线 (xyz)
 * @property {Float32Array} tangent - 切线 (xyz)
 * @property {Float32Array} texCoord - UV坐标 (uv)
 * @property {Uint8Array|Uint16Array} boneIndices - 骨骼索引 (最多4个)
 * @property {Float32Array} boneWeights - 骨骼权重 (最多4个)
 * @property {Float32Array} [color] - 顶点颜色 (rgba)，可选
 */

/**
 * 骨骼网格顶点缓冲区类
 */
export class FSkeletalMeshVertexBuffer extends FVertexBuffer {
    /**
     * @param {GPUDevice} device - GPU设备
     * @param {Object} desc - 骨骼网格顶点缓冲区描述符
     * @param {string} [desc.name] - 资源名称
     * @param {number} desc.vertexCount - 顶点数量
     * @param {boolean} [desc.hasVertexColors=false] - 是否包含顶点颜色
     * @param {number} [desc.maxBoneInfluences=4] - 每个顶点最大骨骼影响数（默认4）
     * @param {boolean} [desc.use16BitBoneIndices=false] - 是否使用16位骨骼索引
     * @param {ArrayBuffer|TypedArray} [desc.initialData] - 初始数据
     */
    constructor(device, desc) {
        const hasColors = desc.hasVertexColors ?? false;
        const maxBoneInfluences = desc.maxBoneInfluences ?? 4;
        const use16BitBoneIndices = desc.use16BitBoneIndices ?? false;

        // 计算每个顶点的大小
        // position(12) + normal(12) + tangent(12) + uv(8) + 
        // boneIndices(maxBoneInfluences * (use16Bit ? 2 : 1)) + 
        // boneWeights(maxBoneInfluences * 4) + [color(16)]
        const stride = 44 + 
            maxBoneInfluences * (use16BitBoneIndices ? 2 : 1) + 
            maxBoneInfluences * 4 + 
            (hasColors ? 16 : 0);

        // 创建顶点属性描述符
        const attributes = [
            {
                name: 'position',
                format: EVertexFormat.FLOAT32X3,
                offset: 0
            },
            {
                name: 'normal',
                format: EVertexFormat.FLOAT32X3,
                offset: 12
            },
            {
                name: 'tangent',
                format: EVertexFormat.FLOAT32X3,
                offset: 24
            },
            {
                name: 'texCoord',
                format: EVertexFormat.FLOAT32X2,
                offset: 36
            },
            {
                name: 'boneIndices',
                format: use16BitBoneIndices ? 
                    (maxBoneInfluences === 4 ? EVertexFormat.UINT16X4 : EVertexFormat.UINT16X2) :
                    (maxBoneInfluences === 4 ? EVertexFormat.UINT8X4 : EVertexFormat.UINT8X2),
                offset: 44
            },
            {
                name: 'boneWeights',
                format: maxBoneInfluences === 4 ? EVertexFormat.FLOAT32X4 : EVertexFormat.FLOAT32X2,
                offset: 44 + maxBoneInfluences * (use16BitBoneIndices ? 2 : 1)
            }
        ];

        // 如果有顶点颜色，添加颜色属性
        if (hasColors) {
            attributes.push({
                name: 'color',
                format: EVertexFormat.FLOAT32X4,
                offset: 44 + maxBoneInfluences * (use16BitBoneIndices ? 2 : 1) + maxBoneInfluences * 4
            });
        }

        super(device, {
            ...desc,
            size: desc.vertexCount * stride,
            stride,
            attributes
        });

        /**
         * 是否包含顶点颜色
         * @type {boolean}
         * @readonly
         */
        this.hasVertexColors = hasColors;

        /**
         * 每个顶点最大骨骼影响数
         * @type {number}
         * @readonly
         */
        this.maxBoneInfluences = maxBoneInfluences;

        /**
         * 是否使用16位骨骼索引
         * @type {boolean}
         * @readonly
         */
        this.use16BitBoneIndices = use16BitBoneIndices;
    }

    /**
     * 更新顶点数据
     * @param {SkeletalMeshVertex[]} vertices - 顶点数据数组
     * @param {number} [startVertex=0] - 起始顶点索引
     */
    updateVertexData(vertices, startVertex = 0) {
        const vertexCount = vertices.length;
        const buffer = new ArrayBuffer(vertexCount * this.stride);
        const dataView = new DataView(buffer);

        for (let i = 0; i < vertexCount; i++) {
            const vertex = vertices[i];
            const offset = i * this.stride;

            // 写入位置
            for (let j = 0; j < 3; j++) {
                dataView.setFloat32(offset + j * 4, vertex.position[j], true);
            }

            // 写入法线
            for (let j = 0; j < 3; j++) {
                dataView.setFloat32(offset + 12 + j * 4, vertex.normal[j], true);
            }

            // 写入切线
            for (let j = 0; j < 3; j++) {
                dataView.setFloat32(offset + 24 + j * 4, vertex.tangent[j], true);
            }

            // 写入UV
            for (let j = 0; j < 2; j++) {
                dataView.setFloat32(offset + 36 + j * 4, vertex.texCoord[j], true);
            }

            // 写入骨骼索引
            const boneIndexOffset = 44;
            for (let j = 0; j < this.maxBoneInfluences; j++) {
                if (this.use16BitBoneIndices) {
                    dataView.setUint16(offset + boneIndexOffset + j * 2, vertex.boneIndices[j], true);
                } else {
                    dataView.setUint8(offset + boneIndexOffset + j, vertex.boneIndices[j]);
                }
            }

            // 写入骨骼权重
            const boneWeightOffset = boneIndexOffset + this.maxBoneInfluences * (this.use16BitBoneIndices ? 2 : 1);
            for (let j = 0; j < this.maxBoneInfluences; j++) {
                dataView.setFloat32(offset + boneWeightOffset + j * 4, vertex.boneWeights[j], true);
            }

            // 如果有顶点颜色，写入颜色
            if (this.hasVertexColors && vertex.color) {
                const colorOffset = boneWeightOffset + this.maxBoneInfluences * 4;
                for (let j = 0; j < 4; j++) {
                    dataView.setFloat32(offset + colorOffset + j * 4, vertex.color[j], true);
                }
            }
        }

        this.updateData(buffer, startVertex * this.stride);
    }
} 