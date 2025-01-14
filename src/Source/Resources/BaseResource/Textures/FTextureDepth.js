import FTexture, { ETextureType, ETextureFormat } from './FTexture';

/**
 * 深度纹理格式枚举
 * @readonly
 * @enum {ETextureFormat}
 */
export const EDepthFormat = {
    /** 24位深度格式（可选8位模板） * 对应 DXGI_FORMAT_D24_UNORM_S8_UINT */
    DEPTH24: ETextureFormat.DEPTH24_PLUS,
    /** 32位浮点深度格式 * 对应 DXGI_FORMAT_D32_FLOAT */
    DEPTH32: ETextureFormat.DEPTH32_FLOAT
};

/**
 * 深度纹理类
 * 用于深度缓冲、阴影贴图等
 */
class FTextureDepth extends FTexture {
    /**
     * @param {GPUDevice} device - GPU设备
     * @param {Object} desc - 深度纹理描述符
     * @param {string} [desc.name] - 资源名称
     * @param {EDepthFormat} [desc.format=EDepthFormat.DEPTH24] - 深度格式
     * @param {number} desc.width - 纹理宽度
     * @param {number} desc.height - 纹理高度
     * @param {boolean} [desc.hasStencil=false] - 是否包含模板
     * @param {number} [desc.sampleCount=1] - MSAA采样数
     * @param {GPUTextureUsageFlags} [desc.usage] - 额外的用途标志
     * @inheritdoc
     */
    constructor(device, desc) {
        const format = desc.format || EDepthFormat.DEPTH24;
        const usage = (desc.usage || 0) |
            GPUTextureUsage.RENDER_ATTACHMENT |
            GPUTextureUsage.TEXTURE_BINDING;

        super(device, {
            ...desc,
            type: ETextureType.TEXTURE_DEPTH,
            format,
            usage
        });

        /**
         * 是否包含模板
         * @type {boolean}
         * @readonly
         */
        this.hasStencil = desc.hasStencil || false;

        /**
         * 比较函数
         * @type {GPUCompareFunction}
         * @private
         */
        this._compareFunction = 'less';
    }

    /**
     * 创建深度纹理视图
     * @override
     * @param {Object} [desc] - 视图描述符
     * @param {GPUCompareFunction} [desc.compare] - 比较函数
     * @returns {GPUTextureView}
     */
    CreateView(desc = {}) {
        if (!this.IsValid()) {
            throw new Error('Cannot create view for invalid depth texture');
        }

        return this._gpuResource.createView({
            format: this.format,
            dimension: '2d',
            aspect: this.hasStencil ? 'depth-stencil' : 'depth-only',
            ...desc
        });
    }

    /**
     * 创建用于阴影贴图的视图
     * @param {GPUCompareFunction} [compareFunction='less'] - 深度比较函数
     * @returns {GPUTextureView}
     */
    CreateShadowView(compareFunction = 'less') {
        this._compareFunction = compareFunction;
        return this.CreateView({
            compare: compareFunction
        });
    }

    /**
     * 设置深度比较函数
     * @param {GPUCompareFunction} compareFunction - 比较函数
     */
    SetCompareFunction(compareFunction) {
        this._compareFunction = compareFunction;
        if (this._view) {
            this._createDefaultView();
        }
    }

    /**
     * 获取深度比较函数
     * @returns {GPUCompareFunction}
     */
    GetCompareFunction() {
        return this._compareFunction;
    }

    /**
     * 创建深度纹理
     * @static
     * @param {GPUDevice} device - GPU设备
     * @param {number} width - 宽度
     * @param {number} height - 高度
     * @param {Object} [options] - 其他选项
     * @param {EDepthFormat} [options.format] - 深度格式
     * @param {boolean} [options.hasStencil] - 是否包含模板
     * @param {number} [options.sampleCount] - MSAA采样数
     * @returns {FTextureDepth}
     */
    static CreateDepthStencil(device, width, height, options = {}) {
        return new FTextureDepth(device, {
            width,
            height,
            format: options.format,
            hasStencil: options.hasStencil,
            sampleCount: options.sampleCount
        });
    }

    /**
     * 创建阴影贴图
     * @static
     * @param {GPUDevice} device - GPU设备
     * @param {number} size - 纹理大小
     * @param {Object} [options] - 其他选项
     * @param {EDepthFormat} [options.format=EDepthFormat.DEPTH32] - 深度格式
     * @returns {FTextureDepth}
     */
    static CreateShadowMap(device, size, options = {}) {
        return new FTextureDepth(device, {
            width: size,
            height: size,
            format: options.format || EDepthFormat.DEPTH32,
            hasStencil: false,
            usage: GPUTextureUsage.RENDER_ATTACHMENT |
                   GPUTextureUsage.TEXTURE_BINDING |
                   GPUTextureUsage.COPY_DST
        });
    }

    /**
     * @override
     * @protected
     */
    _createDefaultView() {
        this._view = this.CreateView({
            compare: this._compareFunction
        });
    }

    /**
     * 生成Mipmap（深度纹理不支持）
     * @override
     */
    GenerateMipmaps() {
        throw new Error('Depth textures do not support mipmaps');
    }
}

export default FTextureDepth; 