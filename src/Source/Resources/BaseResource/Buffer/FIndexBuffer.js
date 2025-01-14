import { FBuffer, EBufferUsage } from './FBuffer';

/**
 * 索引缓冲区格式
 * @readonly
 * @enum {string}
 */
export const EIndexFormat = {
    UINT16: 'uint16',
    UINT32: 'uint32'
};

/**
 * 索引缓冲区类
 * 用于存储几何体的索引数据
 */
export class FIndexBuffer extends FBuffer {
    /**
     * @param {GPUDevice} device - GPU设备
     * @param {Object} desc - Index Buffer描述符
     * @param {string} [desc.name] - 资源名称
     * @param {number} desc.size - Buffer大小（字节）
     * @param {EIndexFormat} [desc.format=EIndexFormat.UINT32] - 索引格式
     * @param {ArrayBuffer|TypedArray} [desc.initialData] - 初始数据
     */
    constructor(device, desc) {
        // 设置Index Buffer的用途标志
        const usage = EBufferUsage.INDEX | EBufferUsage.COPY_DST;

        super(device, {
            ...desc,
            usage
        });

        /**
         * 索引格式
         * @type {EIndexFormat}
         * @readonly
         */
        this.format = desc.format || EIndexFormat.UINT32;

        /**
         * 索引数量
         * @type {number}
         * @readonly
         */
        this.count = this.size / (this.format === EIndexFormat.UINT32 ? 4 : 2);
    }

    /**
     * 获取每个索引的字节大小
     * @returns {number}
     */
    getIndexSize() {
        return this.format === EIndexFormat.UINT32 ? 4 : 2;
    }

    /**
     * 获取索引格式的GPUIndexFormat
     * @returns {GPUIndexFormat}
     */
    getGPUIndexFormat() {
        return this.format;
    }

    /**
     * 更新索引数据
     * @param {Uint16Array|Uint32Array} indices - 新的索引数据
     * @param {number} [offset=0] - 偏移量（字节）
     */
    updateIndices(indices, offset = 0) {
        // 验证索引数据类型
        if (this.format === EIndexFormat.UINT32 && !(indices instanceof Uint32Array)) {
            throw new Error('Index buffer format is UINT32 but provided indices are not Uint32Array');
        }
        if (this.format === EIndexFormat.UINT16 && !(indices instanceof Uint16Array)) {
            throw new Error('Index buffer format is UINT16 but provided indices are not Uint16Array');
        }

        // 更新数据
        this.updateData(indices, offset);
    }
} 