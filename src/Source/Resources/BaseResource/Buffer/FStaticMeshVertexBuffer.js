import { FVertexBuffer, EVertexFormat } from './FVertexBuffer';

/**
 * 静态网格顶点数据结构
 * @typedef {Object} StaticMeshVertex
 * @property {Float32Array} position - 位置 (xyz)
 * @property {Float32Array} normal - 法线 (xyz)
 * @property {Float32Array} tangent - 切线 (xyz)
 * @property {Float32Array} texCoord - UV坐标 (uv)
 * @property {Float32Array} [color] - 顶点颜色 (rgba)，可选
 */

/**
 * 静态网格顶点缓冲区类
 */
export class FStaticMeshVertexBuffer extends FVertexBuffer {
    /**
     * @param {GPUDevice} device - GPU设备
     * @param {Object} desc - 静态网格顶点缓冲区描述符
     * @param {string} [desc.name] - 资源名称
     * @param {number} desc.vertexCount - 顶点数量
     * @param {boolean} [desc.hasVertexColors=false] - 是否包含顶点颜色
     * @param {ArrayBuffer|TypedArray} [desc.initialData] - 初始数据
     */
    constructor(device, desc) {
        // 计算每个顶点的大小
        const hasColors = desc.hasVertexColors ?? false;
        const stride = (3 + 3 + 3 + 2 + (hasColors ? 4 : 0)) * 4; // position + normal + tangent + uv + [color]

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
            }
        ];

        // 如果有顶点颜色，添加颜色属性
        if (hasColors) {
            attributes.push({
                name: 'color',
                format: EVertexFormat.FLOAT32X4,
                offset: 44
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
    }

    /**
     * 更新顶点数据
     * @param {StaticMeshVertex[]} vertices - 顶点数据数组
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

            // 如果有顶点颜色，写入颜色
            if (this.hasVertexColors && vertex.color) {
                for (let j = 0; j < 4; j++) {
                    dataView.setFloat32(offset + 44 + j * 4, vertex.color[j], true);
                }
            }
        }

        this.updateData(buffer, startVertex * this.stride);
    }
} 