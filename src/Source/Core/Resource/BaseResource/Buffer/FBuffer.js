import { FResource } from '../FResource';
/**
 * 缓冲区基类
 * 所有GPU缓冲区的抽象基类，提供基本的缓冲区功能
 * 
 * @example
 * // 通常不直接使用FBuffer，而是使用其子类
 * class FCustomBuffer extends FBuffer {
 *     constructor(device, desc) {
 *         super(device, {
 *             ...desc,
 *             // 设置缓冲区用途
 *             usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
 *         });
 *     }
 * 
 *     // 实现特定的缓冲区功能
 *     async setCustomData(data) {
 *         await this.setData(data);
 *         // 自定义数据处理逻辑
 *     }
 * 
 *     getLayout() {
 *         return {
 *             type: 'storage',
 *             // 布局配置
 *         };
 *     }
 * }
 * 
 * // 使用示例
 * const buffer = new FCustomBuffer(device, {
 *     name: "customBuffer",
 *     size: 1024,  // 缓冲区大小（字节）
 *     mappable: true  // 是否可以映射到CPU
 * });
 * 
 * // 设置数据
 * const data = new Float32Array([1, 2, 3, 4]);
 * await buffer.setData(data);
 * 
 * // 读取数据（如果mappable为true）
 * const readData = await buffer.getData();
 * 
 * // 映射访问（如果mappable为true）
 * await buffer.mapAsync(GPUMapMode.WRITE);
 * const arrayBuffer = buffer.getMappedRange();
 * // 写入数据
 * buffer.unmap();
 * 
 * @note
 * 1. 提供基本的数据传输功能：setData、getData
 * 2. 支持缓冲区映射（需要设置mappable为true）
 * 3. 自动管理GPU资源的创建和销毁
 * 4. 子类需要实现具体的布局和用途
 * 5. 缓冲区大小在创建后不可更改
 * 6. 映射操作必须成对使用：mapAsync/unmap
 */
export class FBuffer extends FResource {
    /**
     * @param {GPUDevice} device - GPU设备
     * @param {Object} desc - 缓冲区描述符
     * @param {string} desc.name - 资源名称
     * @param {number} desc.size - 缓冲区大小（字节）
     * @param {GPUBufferUsageFlags} desc.usage - 缓冲区用途标志
     * @param {boolean} [desc.mappable=false] - 是否可以映射到CPU
     */
    constructor(device, desc) {
        super(device, desc);
        this.size = desc.size;
        this.usage = desc.usage;
        this.mappable = desc.mappable || false;
        this.data = null;
    }

    /**
     * 创建GPU缓冲区
     * @protected
     */
    create() {
        this.gpuResource = this.device.createBuffer({
            size: this.size,
            usage: this.usage,
            mappedAtCreation: false
        });
    }

    /**
     * 获取缓冲区布局
     * 由子类实现具体布局
     * @returns {Object} 缓冲区布局描述符
     */
    getLayout() {
        throw new Error('getLayout() must be implemented by subclass');
    }

    /**
     * 设置缓冲区数据
     * @param {ArrayBuffer | TypedArray} data - 要写入的数据
     * @param {number} [offset=0] - 写入偏移（字节）
     */
    async setData(data, offset = 0) {
        if (!this.validateData(data)) {
            throw new Error('Invalid buffer data');
        }

        const arrayBuffer = data instanceof ArrayBuffer ? data : data.buffer;

        if (this.mappable) {
            await this.mapAsyncWrite();
            const writeArray = new Uint8Array(this.getMappedRange(offset, arrayBuffer.byteLength));
            writeArray.set(new Uint8Array(arrayBuffer));
            this.unmap();
        } else {
            this.device.queue.writeBuffer(
                this.gpuResource,
                offset,
                arrayBuffer,
                0,
                arrayBuffer.byteLength
            );
        }

        this.data = arrayBuffer;
    }

    /**
     * 获取缓冲区数据
     * @param {number} [offset=0] - 读取偏移（字节）
     * @param {number} [size] - 读取大小（字节），默认为剩余大小
     * @returns {Promise<ArrayBuffer>} 缓冲区数据
     */
    async getData(offset = 0, size) {
        const readSize = size || this.size - offset;
        
        if (this.mappable) {
            await this.mapAsyncRead();
            const data = this.getMappedRange(offset, readSize).slice(0);
            this.unmap();
            return data;
        }

        // 创建暂存缓冲区
        const stagingBuffer = this.device.createBuffer({
            size: readSize,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });

        // 复制数据到暂存缓冲区
        const commandEncoder = this.device.createCommandEncoder();
        commandEncoder.copyBufferToBuffer(
            this.gpuResource,
            offset,
            stagingBuffer,
            0,
            readSize
        );
        this.device.queue.submit([commandEncoder.finish()]);

        // 读取暂存缓冲区
        await stagingBuffer.mapAsync(GPUMapMode.READ);
        const data = stagingBuffer.getMappedRange().slice(0);
        stagingBuffer.unmap();
        stagingBuffer.destroy();

        return data;
    }

    /**
     * 映射缓冲区用于写入
     * @returns {Promise<void>}
     */
    async mapAsyncWrite() {
        if (!this.mappable) {
            throw new Error('Buffer is not mappable');
        }
        await this.gpuResource.mapAsync(GPUMapMode.WRITE);
    }

    /**
     * 映射缓冲区用于读取
     * @returns {Promise<void>}
     */
    async mapAsyncRead() {
        if (!this.mappable) {
            throw new Error('Buffer is not mappable');
        }
        await this.gpuResource.mapAsync(GPUMapMode.READ);
    }

    /**
     * 获取映射的内存范围
     * @param {number} [offset=0] - 偏移（字节）
     * @param {number} [size] - 大小（字节）
     * @returns {ArrayBuffer} 映射的内存范围
     */
    getMappedRange(offset = 0, size) {
        if (!this.mappable) {
            throw new Error('Buffer is not mappable');
        }
        return this.gpuResource.getMappedRange(offset, size);
    }

    /**
     * 取消映射
     */
    unmap() {
        if (!this.mappable) {
            throw new Error('Buffer is not mappable');
        }
        this.gpuResource.unmap();
    }

    /**
     * 验证缓冲区描述符
     * @protected
     * @returns {boolean} 验证结果
     */
    validateDesc() {
        return (
            super.validateDesc() &&
            typeof this.size === 'number' &&
            this.size > 0 &&
            typeof this.usage === 'number' &&
            this.usage !== 0
        );
    }

    /**
     * 验证缓冲区数据
     * @protected
     * @param {ArrayBuffer | TypedArray} data - 要验证的数据
     * @returns {boolean} 验证结果
     */
    validateData(data) {
        return (
            (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) &&
            data.byteLength <= this.size
        );
    }

    /**
     * 验证大小
     * @protected
     * @param {number} size - 要验证的大小
     * @returns {boolean} 验证结果
     */
    validateSize(size) {
        return typeof size === 'number' && size > 0 && size <= this.size;
    }
} 