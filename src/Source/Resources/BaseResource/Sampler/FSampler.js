import FRenderResource from '../FRenderResource';

/**
 * 采样器类型枚举
 * @readonly
 * @enum {string}
 */
export const ESamplerType = {
    /** 线性采样 */
    LINEAR: 'linear',
    /** 点采样 */
    POINT: 'point',
    /** 各向异性采样 */
    ANISOTROPIC: 'anisotropic',
    /** 阴影采样 */
    SHADOW: 'shadow',
    /** 比较采样 */
    COMPARISON: 'comparison'
};

/**
 * GPU采样器资源类
 * 用于管理纹理采样的状态和配置
 */
export class FSampler extends FRenderResource {
    /**
     * @param {GPUDevice} device - GPU设备
     * @param {Object} desc - 采样器描述符
     * @param {string} [desc.name] - 资源名称，用于调试和识别
     * @param {ESamplerType} desc.type - 采样器类型
     * @param {GPUAddressMode} [desc.addressModeU='clamp-to-edge'] - U方向寻址模式
     * @param {GPUAddressMode} [desc.addressModeV='clamp-to-edge'] - V方向寻址模式
     * @param {GPUAddressMode} [desc.addressModeW='clamp-to-edge'] - W方向寻址模式
     * @param {GPUFilterMode} [desc.magFilter='linear'] - 放大过滤
     * @param {GPUFilterMode} [desc.minFilter='linear'] - 缩小过滤
     * @param {GPUMipmapFilterMode} [desc.mipmapFilter='linear'] - Mipmap过滤
     * @param {number} [desc.lodMinClamp=0] - 最小LOD限制
     * @param {number} [desc.lodMaxClamp=32] - 最大LOD限制
     * @param {GPUCompareFunction} [desc.compare] - 比较函数
     * @param {number} [desc.maxAnisotropy=1] - 最大各向异性
     * @inheritdoc
     */
    constructor(device, desc) {
        super(device, desc.name);

        /**
         * 采样器类型
         * @type {ESamplerType}
         * @readonly
         */
        this.type = desc.type;

        /**
         * 采样器配置
         * @type {Object}
         * @private
         */
        this._config = {
            addressModeU: desc.addressModeU || 'clamp-to-edge',
            addressModeV: desc.addressModeV || 'clamp-to-edge',
            addressModeW: desc.addressModeW || 'clamp-to-edge',
            magFilter: desc.magFilter || 'linear',
            minFilter: desc.minFilter || 'linear',
            mipmapFilter: desc.mipmapFilter || 'linear',
            lodMinClamp: desc.lodMinClamp || 0,
            lodMaxClamp: desc.lodMaxClamp || 32,
            compare: desc.compare,
            maxAnisotropy: desc.maxAnisotropy || 1
        };
    }

    /**
     * 初始化采样器
     * @override
     */
    async Initialize() {
        this._validateDevice();
        try {
            this._updateState('initializing');
            this._gpuResource = this.device.createSampler(this._config);
            this._updateState('ready');
        } catch (error) {
            this._handleError(error);
        }
    }

    /**
     * 销毁采样器
     * @override
     */
    Destroy() {
        this._gpuResource = null; // WebGPU采样器不需要手动销毁
        this._updateState('destroyed');
    }

    /**
     * 更新采样器（采样器是不可变的，此方法仅用于接口一致性）
     * @override
     */
    async Update() {
        throw new Error('Sampler is immutable');
    }

    /**
     * 绑定到渲染通道
     * @override
     * @param {GPURenderPassEncoder} renderPass - 渲染通道编码器
     * @param {number} bindingPoint - 绑定点
     */
    BindToRenderPass(renderPass, bindingPoint) {
        if (!this.IsValid()) {
            throw new Error('Cannot bind invalid sampler');
        }
        // 具体的绑定逻辑将在绑定组中实现
    }

    /**
     * 绑定到计算通道
     * @override
     * @param {GPUComputePassEncoder} computePass - 计算通道编码器
     * @param {number} bindingPoint - 绑定点
     */
    BindToComputePass(computePass, bindingPoint) {
        if (!this.IsValid()) {
            throw new Error('Cannot bind invalid sampler');
        }
        // 具体的绑定逻辑将在绑定组中实现
    }

    /**
     * 创建线性采样器
     * @static
     * @param {GPUDevice} device - GPU设备
     * @returns {FSampler}
     */
    static CreateLinear(device) {
        return new FSampler(device, {
            type: ESamplerType.LINEAR,
            magFilter: 'linear',
            minFilter: 'linear',
            mipmapFilter: 'linear'
        });
    }

    /**
     * 创建点采样器
     * @static
     * @param {GPUDevice} device - GPU设备
     * @returns {FSampler}
     */
    static CreatePoint(device) {
        return new FSampler(device, {
            type: ESamplerType.POINT,
            magFilter: 'nearest',
            minFilter: 'nearest',
            mipmapFilter: 'nearest'
        });
    }

    /**
     * 创建各向异性采样器
     * @static
     * @param {GPUDevice} device - GPU设备
     * @param {number} [maxAnisotropy=16] - 最大各向异性级别
     * @returns {FSampler}
     */
    static CreateAnisotropic(device, maxAnisotropy = 16) {
        return new FSampler(device, {
            type: ESamplerType.ANISOTROPIC,
            magFilter: 'linear',
            minFilter: 'linear',
            mipmapFilter: 'linear',
            maxAnisotropy
        });
    }

    /**
     * 创建阴影贴图采样器
     * @static
     * @param {GPUDevice} device - GPU设备
     * @returns {FSampler}
     */
    static CreateShadow(device) {
        return new FSampler(device, {
            type: ESamplerType.SHADOW,
            compare: 'less',
            magFilter: 'linear',
            minFilter: 'linear',
            mipmapFilter: 'linear'
        });
    }

    /**
     * 获取采样器类型
     * @returns {ESamplerType}
     */
    GetType() {
        return this.type;
    }

    /**
     * 获取采样器配置
     * @returns {Object}
     */
    GetConfig() {
        return { ...this._config };
    }
}

export default FSampler; 