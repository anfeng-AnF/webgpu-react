import { FBuffer, EBufferUsage } from './FBuffer';

/**
 * 顶点属性格式
 * @readonly
 * @enum {string}
 */
export const EVertexFormat = {
    // 8位格式
    UINT8X2: 'uint8x2',
    UINT8X4: 'uint8x4',
    SINT8X2: 'sint8x2',
    SINT8X4: 'sint8x4',
    UNORM8X2: 'unorm8x2',
    UNORM8X4: 'unorm8x4',
    SNORM8X2: 'snorm8x2',
    SNORM8X4: 'snorm8x4',

    // 16位格式
    UINT16X2: 'uint16x2',
    UINT16X4: 'uint16x4',
    SINT16X2: 'sint16x2',
    SINT16X4: 'sint16x4',
    UNORM16X2: 'unorm16x2',
    UNORM16X4: 'unorm16x4',
    SNORM16X2: 'snorm16x2',
    SNORM16X4: 'snorm16x4',
    FLOAT16X2: 'float16x2',
    FLOAT16X4: 'float16x4',

    // 32位格式
    UINT32X2: 'uint32x2',
    UINT32X3: 'uint32x3',
    UINT32X4: 'uint32x4',
    SINT32X2: 'sint32x2',
    SINT32X3: 'sint32x3',
    SINT32X4: 'sint32x4',
    FLOAT32X2: 'float32x2',
    FLOAT32X3: 'float32x3',
    FLOAT32X4: 'float32x4'
};

/**
 * 获取顶点格式的字节大小
 * @param {EVertexFormat} format - 顶点格式
 * @returns {number} 字节大小
 */
export function GetVertexFormatSize(format) {
    switch (format) {
        // 8位格式
        case EVertexFormat.UINT8X2:
        case EVertexFormat.SINT8X2:
        case EVertexFormat.UNORM8X2:
        case EVertexFormat.SNORM8X2:
            return 2;
        case EVertexFormat.UINT8X4:
        case EVertexFormat.SINT8X4:
        case EVertexFormat.UNORM8X4:
        case EVertexFormat.SNORM8X4:
            return 4;

        // 16位格式
        case EVertexFormat.UINT16X2:
        case EVertexFormat.SINT16X2:
        case EVertexFormat.UNORM16X2:
        case EVertexFormat.SNORM16X2:
        case EVertexFormat.FLOAT16X2:
            return 4;
        case EVertexFormat.UINT16X4:
        case EVertexFormat.SINT16X4:
        case EVertexFormat.UNORM16X4:
        case EVertexFormat.SNORM16X4:
        case EVertexFormat.FLOAT16X4:
            return 8;

        // 32位格式
        case EVertexFormat.UINT32X2:
        case EVertexFormat.SINT32X2:
        case EVertexFormat.FLOAT32X2:
            return 8;
        case EVertexFormat.UINT32X3:
        case EVertexFormat.SINT32X3:
        case EVertexFormat.FLOAT32X3:
            return 12;
        case EVertexFormat.UINT32X4:
        case EVertexFormat.SINT32X4:
        case EVertexFormat.FLOAT32X4:
            return 16;

        default:
            throw new Error(`Unknown vertex format: ${format}`);
    }
}

/**
 * 顶点属性描述符
 * @typedef {Object} VertexAttributeDescriptor
 * @property {string} name - 属性名称
 * @property {EVertexFormat} format - 属性格式
 * @property {number} offset - 属性在顶点中的偏移（字节）
 * @property {number} [location] - 着色器位置（可选，默认自动分配）
 */

/**
 * 顶点缓冲区类
 */
export class FVertexBuffer extends FBuffer {
    /**
     * @param {GPUDevice} device - GPU设备
     * @param {Object} desc - Vertex Buffer描述符
     * @param {string} [desc.name] - 资源名称
     * @param {number} desc.size - Buffer大小（字节）
     * @param {number} desc.stride - 每个顶点的字节大小
     * @param {VertexAttributeDescriptor[]} desc.attributes - 顶点属性描述符数组
     * @param {ArrayBuffer|TypedArray} [desc.initialData] - 初始数据
     */
    constructor(device, desc) {
        // 设置Vertex Buffer的用途标志
        const usage = EBufferUsage.VERTEX | EBufferUsage.COPY_DST;

        super(device, {
            ...desc,
            usage
        });

        /**
         * 每个顶点的字节大小
         * @type {number}
         * @readonly
         */
        this.stride = desc.stride;

        /**
         * 顶点数量
         * @type {number}
         * @readonly
         */
        this.vertexCount = this.size / this.stride;

        /**
         * 顶点属性描述符数组
         * @type {VertexAttributeDescriptor[]}
         * @readonly
         */
        this.attributes = desc.attributes.map((attr, index) => ({
            ...attr,
            location: attr.location ?? index
        }));

        // 验证属性描述符
        this._validateAttributes();
    }

    /**
     * 验证顶点属性描述符
     * @private
     */
    _validateAttributes() {
        // 检查属性偏移是否超出stride
        for (const attr of this.attributes) {
            const attrSize = GetVertexFormatSize(attr.format);
            if (attr.offset + attrSize > this.stride) {
                throw new Error(`Attribute '${attr.name}' exceeds vertex stride`);
            }
        }

        // 检查属性是否重叠
        for (let i = 0; i < this.attributes.length; i++) {
            const a = this.attributes[i];
            const aSize = GetVertexFormatSize(a.format);
            for (let j = i + 1; j < this.attributes.length; j++) {
                const b = this.attributes[j];
                const bSize = GetVertexFormatSize(b.format);
                
                if (!(a.offset + aSize <= b.offset || b.offset + bSize <= a.offset)) {
                    throw new Error(`Attributes '${a.name}' and '${b.name}' overlap`);
                }
            }
        }
    }

    /**
     * 获取顶点缓冲区布局描述符
     * @returns {GPUVertexBufferLayout}
     */
    getVertexBufferLayout() {
        return {
            arrayStride: this.stride,
            attributes: this.attributes.map(attr => ({
                format: attr.format,
                offset: attr.offset,
                shaderLocation: attr.location
            }))
        };
    }

    /**
     * 更新顶点数据
     * @param {ArrayBuffer|TypedArray} vertices - 新的顶点数据
     * @param {number} [offset=0] - 偏移量（字节）
     */
    updateVertices(vertices, offset = 0) {
        const dataSize = vertices instanceof ArrayBuffer ? vertices.byteLength : vertices.buffer.byteLength;
        if (dataSize % this.stride !== 0) {
            throw new Error('Vertex data size must be a multiple of vertex stride');
        }
        this.updateData(vertices, offset);
    }
} 