import { FBuffer } from './FBuffer';

/**
 * 索引缓冲区格式枚举
 * @enum {string}
 */
export const EIndexFormat = {
    UINT16: 'uint16',
    UINT32: 'uint32'
};

/**
 * 索引缓冲区类
 * 管理索引数据和格式
 * 
 * @example
 * // 1. 创建16位索引缓冲区
 * const indexBuffer16 = FIndexBuffer.createUint16Buffer(device, "indices", 1000);
 * 
 * // 设置索引数据
 * const indices16 = new Uint16Array([
 *     0, 1, 2,  // 三角形1
 *     2, 1, 3   // 三角形2
 * ]);
 * await indexBuffer16.setIndices(indices16);
 * 
 * // 2. 创建32位索引缓冲区（用于大型模型）
 * const indexBuffer32 = FIndexBuffer.createUint32Buffer(device, "largeIndices", 1000000);
 * 
 * // 设置32位索引数据
 * const indices32 = new Uint32Array([
 *     // ... 大量索引数据 ...
 * ]);
 * await indexBuffer32.setIndices(indices32);
 * 
 * // 3. 在渲染管线中使用
 * // 设置索引缓冲区
 * renderPass.setIndexBuffer(indexBuffer16.getResource(), indexBuffer16.getIndexFormat());
 * renderPass.drawIndexed(indexBuffer16.getIndexCount());
 * 
 * @note
 * 1. 16位索引最多支持65536个顶点
 * 2. 大型模型应使用32位索引
 * 3. 索引数据必须匹配创建时指定的格式
 * 4. drawIndexed的数量必须不超过索引数量
 */
export class FIndexBuffer extends FBuffer {
    /**
     * @param {GPUDevice} device - GPU设备
     * @param {Object} desc - 索引缓冲区描述符
     * @param {string} desc.name - 资源名称
     * @param {number} desc.size - 缓冲区大小（字节）
     * @param {EIndexFormat} [desc.format=EIndexFormat.UINT16] - 索引格式
     */
    constructor(device, desc) {
        super(device, {
            ...desc,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
        });

        this.format = desc.format || EIndexFormat.UINT16;
        this.indexCount = 0;
        this.indexSize = this.getIndexSize();
    }

    /**
     * 设置索引数据
     * @param {Uint16Array|Uint32Array} data - 索引数据
     */
    async setIndices(data) {
        if (!this.validateIndices(data)) {
            throw new Error('Invalid index data format');
        }

        await this.setData(data.buffer);
        this.indexCount = data.length;
    }

    /**
     * 获取索引数量
     * @returns {number} 索引数量
     */
    getIndexCount() {
        return this.indexCount;
    }

    /**
     * 获取索引格式
     * @returns {GPUIndexFormat} GPU索引格式
     */
    getIndexFormat() {
        return this.format;
    }

    /**
     * 获取缓冲区布局
     * @returns {Object} 缓冲区布局描述符
     */
    getLayout() {
        return {
            type: 'index',
            format: this.format
        };
    }

    /**
     * 获取单个索引大小
     * @protected
     * @returns {number} 索引大小（字节）
     */
    getIndexSize() {
        return this.format === EIndexFormat.UINT16 ? 2 : 4;
    }

    /**
     * 验证索引数据
     * @protected
     * @param {Uint16Array|Uint32Array} data - 要验证的数据
     * @returns {boolean} 验证结果
     */
    validateIndices(data) {
        if (this.format === EIndexFormat.UINT16) {
            return data instanceof Uint16Array;
        } else {
            return data instanceof Uint32Array;
        }
    }

    /**
     * 验证缓冲区描述符
     * @protected
     * @returns {boolean} 验证结果
     */
    validateDesc() {
        return (
            super.validateDesc() &&
            (!this.format || Object.values(EIndexFormat).includes(this.format))
        );
    }

    // 静态工厂方法
    /**
     * 创建16位索引缓冲区
     * @param {GPUDevice} device - GPU设备
     * @param {string} name - 资源名称
     * @param {number} [indexCount=1024] - 索引数量
     * @returns {FIndexBuffer} 索引缓冲区
     */
    static createUint16Buffer(device, name, indexCount = 1024) {
        return new FIndexBuffer(device, {
            name,
            size: indexCount * 2,
            format: EIndexFormat.UINT16
        });
    }

    /**
     * 创建32位索引缓冲区
     * @param {GPUDevice} device - GPU设备
     * @param {string} name - 资源名称
     * @param {number} [indexCount=1024] - 索引数量
     * @returns {FIndexBuffer} 索引缓冲区
     */
    static createUint32Buffer(device, name, indexCount = 1024) {
        return new FIndexBuffer(device, {
            name,
            size: indexCount * 4,
            format: EIndexFormat.UINT32
        });
    }

    /**
     * 获取16位索引缓冲区布局
     * @returns {Object} 缓冲区布局
     */
    static getUint16Layout() {
        const tempBuffer = new FIndexBuffer(null, {
            name: "temp",
            size: 0,
            format: EIndexFormat.UINT16
        });
        return tempBuffer.getLayout();
    }

    /**
     * 获取32位索引缓冲区布局
     * @returns {Object} 缓冲区布局
     */
    static getUint32Layout() {
        const tempBuffer = new FIndexBuffer(null, {
            name: "temp",
            size: 0,
            format: EIndexFormat.UINT32
        });
        return tempBuffer.getLayout();
    }
} 