import { FBuffer, EBufferUsage } from './FBuffer';

/**
 * Uniform缓冲区类
 * 用于存储着色器统一变量数据
 */
export class FUniformBuffer extends FBuffer {
    /**
     * @param {GPUDevice} device - GPU设备
     * @param {Object} desc - Uniform Buffer描述符
     * @param {string} [desc.name] - 资源名称
     * @param {number} desc.size - Buffer大小（字节）
     * @param {boolean} [desc.dynamic=true] - 是否为动态Uniform Buffer
     * @param {ArrayBuffer|TypedArray} [desc.initialData] - 初始数据
     */
    constructor(device, desc) {
        // 设置Uniform Buffer的用途标志
        const usage = EBufferUsage.UNIFORM | EBufferUsage.COPY_DST;

        super(device, {
            ...desc,
            usage,
            // 如果是动态Uniform Buffer，设置为可映射
            mappable: desc.dynamic ?? true
        });

        /**
         * 是否为动态Uniform Buffer
         * @type {boolean}
         * @readonly
         */
        this.dynamic = desc.dynamic ?? true;

        /**
         * 绑定组索引
         * @type {number}
         * @private
         */
        this._groupIndex = -1;

        /**
         * 绑定点索引
         * @type {number}
         * @private
         */
        this._bindingIndex = -1;
    }

    /**
     * 设置绑定位置
     * @param {number} groupIndex - 绑定组索引
     * @param {number} bindingIndex - 绑定点索引
     */
    setBindingLocation(groupIndex, bindingIndex) {
        this._groupIndex = groupIndex;
        this._bindingIndex = bindingIndex;
    }

    /**
     * 获取绑定组索引
     * @returns {number}
     */
    getGroupIndex() {
        return this._groupIndex;
    }

    /**
     * 获取绑定点索引
     * @returns {number}
     */
    getBindingIndex() {
        return this._bindingIndex;
    }

    /**
     * 获取绑定组布局条目
     * @returns {GPUBindGroupLayoutEntry}
     */
    getBindGroupLayoutEntry() {
        return {
            binding: this._bindingIndex,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
            buffer: {
                type: 'uniform',
                hasDynamicOffset: this.dynamic,
                minBindingSize: this.size
            }
        };
    }

    /**
     * 获取绑定组条目
     * @returns {GPUBindGroupEntry}
     */
    getBindGroupEntry() {
        return {
            binding: this._bindingIndex,
            resource: {
                buffer: this.getGPUBuffer(),
                offset: 0,
                size: this.size
            }
        };
    }
} 