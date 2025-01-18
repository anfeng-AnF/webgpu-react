/**
 * GPU资源的基类
 * 提供基本的资源管理功能和生命周期控制
 */
export class FRenderResource {
    /**
     * @param {GPUDevice} device - GPU设备
     * @param {string} name - 资源名称
     */
    constructor(device, name = '') {
        if (!device) {
            throw new Error('FRenderResource requires a valid GPUDevice');
        }

        /**
         * GPU设备引用
         * @type {GPUDevice}
         * @readonly
         */
        this.device = device;

        /**
         * 资源名称，用于调试和识别
         * @type {string}
         */
        this.name = name;

        /**
         * 资源唯一标识符
         * @type {string}
         * @readonly
         */
        this.id = crypto.randomUUID();

        /**
         * 引用计数，用于资源生命周期管理
         * 当计数为0时，资源可以被安全释放
         * @type {number}
         * @private
         */
        this.refCount = 0;

        /**
         * 资源当前状态
         * - uninitialized: 未初始化
         * - initializing: 正在初始化
         * - ready: 就绪可用
         * - error: 错误状态
         * - destroyed: 已销毁
         * @type {'uninitialized'|'initializing'|'ready'|'error'|'destroyed'}
         * @protected
         */
        this.state = 'uninitialized';

        /**
         * 底层GPU资源对象
         * 可能是GPUBuffer、GPUTexture或GPUSampler等
         * @type {GPUBuffer|GPUTexture|GPUSampler|null}
         * @protected
         */
        this._gpuResource = null;
    }

    /**
     * 初始化资源
     * @abstract
     * @returns {Promise<void>}
     */
    async Initialize() {
        throw new Error('Initialize() must be implemented by derived class');
    }

    /**
     * 销毁资源
     * @abstract
     */
    Destroy() {
        throw new Error('Destroy() must be implemented by derived class');
    }

    /**
     * 更新资源
     * @abstract
     * @returns {Promise<void>}
     */
    async Update() {
        throw new Error('Update() must be implemented by derived class');
    }

    /**
     * 绑定到渲染通道
     * @abstract
     * @param {GPURenderPassEncoder} renderPass - 渲染通道编码器
     * @param {number} [bindingPoint] - 绑定点
     */
    BindToRenderPass(renderPass, bindingPoint) {
        throw new Error('BindToRenderPass() must be implemented by derived class');
    }

    /**
     * 绑定到计算通道
     * @abstract
     * @param {GPUComputePassEncoder} computePass - 计算通道编码器
     * @param {number} [bindingPoint] - 绑定点
     */
    BindToComputePass(computePass, bindingPoint) {
        throw new Error('BindToComputePass() must be implemented by derived class');
    }

    /**
     * 获取GPU资源
     * @returns {GPUBuffer|GPUTexture|GPUSampler|null}
     */
    GetGPUResource() {
        return this._gpuResource;
    }

    /**
     * 增加引用计数
     * @returns {FRenderResource} 返回自身以支持链式调用
     */
    AddRef() {
        this.refCount++;
        return this;
    }

    /**
     * 减少引用计数
     */
    Release() {
        this.refCount--;
        if (this.refCount <= 0) {
            this.Destroy();
        }
    }

    /**
     * 检查资源是否有效
     * @returns {boolean}
     */
    IsValid() {
        return this._gpuResource !== null && this.state === 'ready';
    }

    /**
     * 获取资源大小（字节）
     * @abstract
     * @returns {number}
     */
    GetSize() {
        return 0;
    }

    /**
     * 获取资源类型
     * @returns {string}
     */
    GetResourceType() {
        return this.constructor.name;
    }

    /**
     * 设置调试名称
     * @param {string} name 
     */
    SetDebugName(name) {
        this.name = name;
        if (this._gpuResource && this._gpuResource.label !== undefined) {
            this._gpuResource.label = name;
        }
    }

    /**
     * 转换为字符串
     * @returns {string}
     */
    toString() {
        return `${this.GetResourceType()}(${this.name || this.id})`;
    }

    /**
     * 处理资源错误
     * @protected
     * @param {Error} error 
     */
    _handleError(error) {
        this.state = 'error';
        console.error(`Error in ${this.toString()}:`, error);
        throw error;
    }

    /**
     * 验证设备状态
     * @protected
     */
    _validateDevice() {
        if (!this.device) {
            console.error('GPU device is null or undefined', this.device);
            throw new Error('GPU device is null or undefined');
        }

        // 检查设备是否已丢失
        if (this.device.lost) {
            console.log('Checking GPU device lost state:', this.device.lost);
            this.device.lost.then((info) => {
                console.error('GPU device was lost:', info);
            });
        }

        // 检查设备队列是否可用
        if (!this.device.queue) {
            console.error('GPU device queue is not available', this.device);
            throw new Error('GPU device queue is not available');
        }
    }

    /**
     * 更新资源状态
     * @protected
     * @param {'uninitialized'|'initializing'|'ready'|'error'|'destroyed'} newState 
     */
    _updateState(newState) {
        this.state = newState;
    }
}

export default FRenderResource; 