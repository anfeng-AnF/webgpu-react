import { FRenderResource } from '../FRenderResource';

/**
 * Buffer usage flags
 * @readonly
 * @enum {number}
 */
export const EBufferUsage = {
    VERTEX:        0x0001,  // GPUBufferUsage.VERTEX
    INDEX:         0x0002,  // GPUBufferUsage.INDEX
    UNIFORM:       0x0004,  // GPUBufferUsage.UNIFORM
    STORAGE:       0x0008,  // GPUBufferUsage.STORAGE
    INDIRECT:      0x0010,  // GPUBufferUsage.INDIRECT
    MAP_READ:      0x0020,  // GPUBufferUsage.MAP_READ
    MAP_WRITE:     0x0040,  // GPUBufferUsage.MAP_WRITE
    COPY_SRC:      0x0080,  // GPUBufferUsage.COPY_SRC
    COPY_DST:      0x0100,  // GPUBufferUsage.COPY_DST
};

/**
 * Base class for all buffer resources
 */
export class FBuffer extends FRenderResource {
    /**
     * @param {GPUDevice} device - GPU设备
     * @param {Object} desc - Buffer描述符
     * @param {string} [desc.name] - 资源名称
     * @param {number} desc.size - Buffer大小（字节）
     * @param {number} desc.usage - Buffer用途标志位
     * @param {boolean} [desc.mappable=false] - 是否可映射
     * @param {ArrayBuffer|TypedArray} [desc.initialData] - 初始数据
     */
    constructor(device, desc) {
        super(device, desc.name);

        /**
         * Buffer大小（字节）
         * @type {number}
         * @readonly
         */
        this.size = desc.size;

        /**
         * Buffer用途标志位
         * @type {number}
         * @readonly
         */
        this.usage = desc.usage;

        /**
         * 是否可映射
         * @type {boolean}
         * @readonly
         */
        this.mappable = desc.mappable ?? false;

        /**
         * GPU Buffer对象
         * @type {GPUBuffer}
         * @private
         */
        this._gpuBuffer = null;

        // 创建Buffer
        this._createBuffer(desc.initialData);
    }

    /**
     * 创建GPU Buffer
     * @private
     * @param {ArrayBuffer|TypedArray} [initialData] - 初始数据
     */
    _createBuffer(initialData) {
        let usage = this.usage;
        
        // 如果提供了初始数据，需要添加COPY_DST标志
        if (initialData) {
            usage |= EBufferUsage.COPY_DST;
        }

        // 创建Buffer描述符
        const descriptor = {
            size: this.size,
            usage: usage,
            mappedAtCreation: initialData ? true : false
        };

        // 创建GPU Buffer
        this._gpuBuffer = this.device.createBuffer(descriptor);

        // 如果有初始数据，写入数据
        if (initialData) {
            const mappedRange = new Uint8Array(this._gpuBuffer.getMappedRange());
            if (initialData instanceof ArrayBuffer) {
                mappedRange.set(new Uint8Array(initialData));
            } else {
                mappedRange.set(new Uint8Array(initialData.buffer));
            }
            this._gpuBuffer.unmap();
        }
    }

    /**
     * 更新Buffer数据
     * @param {ArrayBuffer|TypedArray} data - 新数据
     * @param {number} [offset=0] - 偏移量（字节）
     */
    updateData(data, offset = 0) {
        if (!this._gpuBuffer) {
            throw new Error('Buffer not created');
        }

        const dataSize = data instanceof ArrayBuffer ? data.byteLength : data.buffer.byteLength;
        if (offset + dataSize > this.size) {
            throw new Error('Data size exceeds buffer size');
        }

        // 创建临时staging buffer
        const stagingBuffer = this.device.createBuffer({
            size: dataSize,
            usage: EBufferUsage.COPY_SRC | EBufferUsage.MAP_WRITE,
            mappedAtCreation: true
        });

        // 写入数据到staging buffer
        const mappedRange = new Uint8Array(stagingBuffer.getMappedRange());
        if (data instanceof ArrayBuffer) {
            mappedRange.set(new Uint8Array(data));
        } else {
            mappedRange.set(new Uint8Array(data.buffer));
        }
        stagingBuffer.unmap();

        // 创建命令编码器
        const commandEncoder = this.device.createCommandEncoder();
        commandEncoder.copyBufferToBuffer(
            stagingBuffer,
            0,
            this._gpuBuffer,
            offset,
            dataSize
        );

        // 提交命令
        this.device.queue.submit([commandEncoder.finish()]);

        // 销毁staging buffer
        stagingBuffer.destroy();
    }

    /**
     * 映射Buffer以读取数据
     * @async
     * @returns {Promise<ArrayBuffer>}
     */
    async mapRead() {
        if (!this.mappable || !(this.usage & EBufferUsage.MAP_READ)) {
            throw new Error('Buffer is not mappable for reading');
        }

        await this._gpuBuffer.mapAsync(1);
        const mappedRange = this._gpuBuffer.getMappedRange();
        const data = new Uint8Array(mappedRange).slice();
        this._gpuBuffer.unmap();
        return data.buffer;
    }

    /**
     * 映射Buffer以写入数据
     * @async
     * @returns {Promise<ArrayBuffer>}
     */
    async mapWrite() {
        if (!this.mappable || !(this.usage & EBufferUsage.MAP_WRITE)) {
            throw new Error('Buffer is not mappable for writing');
        }

        await this._gpuBuffer.mapAsync(2);
        const mappedRange = this._gpuBuffer.getMappedRange();
        return mappedRange;
    }

    /**
     * 获取GPU Buffer对象
     * @returns {GPUBuffer}
     */
    getGPUBuffer() {
        return this._gpuBuffer;
    }

    /**
     * 销毁资源
     * @override
     */
    destroy() {
        if (this._gpuBuffer) {
            this._gpuBuffer.destroy();
            this._gpuBuffer = null;
        }
        super.destroy();
    }
} 