import FRenderResource from '../FRenderResource';

/**
 * 纹理类型枚举
 * @readonly
 * @enum {string}
 */
export const ETextureType = {
    /** 2D纹理 */
    TEXTURE_2D: 'texture2d',
    /** 3D纹理 */
    TEXTURE_3D: 'texture3d',
    /** 立方体纹理 */
    TEXTURE_CUBE: 'texturecube',
    /** 2D纹理数组 */
    TEXTURE_2D_ARRAY: 'texture2darray',
    /** 深度纹理 */
    TEXTURE_DEPTH: 'depth',
    /** 深度纹理数组 */
    TEXTURE_DEPTH_ARRAY: 'deptharray'
};

/**
 * 纹理格式枚举
 * @readonly
 * @enum {string}
 */
export const ETextureFormat = {
    /** 
     * 8位RGBA格式 (标准化，范围 [0, 1]) 
     * 对应 DXGI_FORMAT_R8G8B8A8_UNORM 
     */
    RGBA8_UNORM: 'rgba8unorm',

    /** 
     * 16位浮点RGBA格式 (高动态范围渲染) 
     * 对应 DXGI_FORMAT_R16G16B16A16_FLOAT 
     */
    RGBA16_FLOAT: 'rgba16float',

    /** 
     * 32位浮点RGBA格式 (高精度 HDR 或科学计算) 
     * 对应 DXGI_FORMAT_R32G32B32A32_FLOAT 
     */
    RGBA32_FLOAT: 'rgba32float',

    /** 
     * 24位深度格式 (WebGPU 抽象格式，具体映射到 DXGI_FORMAT_D24_UNORM_S8_UINT) 
     */
    DEPTH24_PLUS: 'depth24plus',

    /** 
     * 32位浮点深度格式 (高精度深度缓冲) 
     * 对应 DXGI_FORMAT_D32_FLOAT 
     */
    DEPTH32_FLOAT: 'depth32float',

    /** 
     * BC1压缩格式 (4位/像素，适合不透明或简单透明纹理) 
     * 对应 DXGI_FORMAT_BC1_UNORM 
     */
    BC1_RGBA_UNORM: 'bc1-rgba-unorm',

    /** 
     * BC2压缩格式 (8位/像素，适合有 alpha 通道的纹理) 
     * 对应 DXGI_FORMAT_BC2_UNORM 
     */
    BC2_RGBA_UNORM: 'bc2-rgba-unorm',

    /** 
     * BC3压缩格式 (8位/像素，适合高质量有 alpha 通道的纹理) 
     * 对应 DXGI_FORMAT_BC3_UNORM 
     */
    BC3_RGBA_UNORM: 'bc3-rgba-unorm',

    /** 
     * BC4压缩格式 (单通道，适合高度图等) 
     * 对应 DXGI_FORMAT_BC4_UNORM 
     */
    BC4_R_UNORM: 'bc4-r-unorm',

    /** 
     * BC5压缩格式 (双通道，适合法线贴图) 
     * 对应 DXGI_FORMAT_BC5_UNORM 
     */
    BC5_RG_UNORM: 'bc5-rg-unorm',

    /** 
     * BC6H压缩格式 (HDR，适合浮点 HDR 纹理) 
     * 对应 DXGI_FORMAT_BC6H_UF16 
     */
    BC6H_RGB_FLOAT: 'bc6h-rgb-float',

    /** 
     * BC7压缩格式 (高质量 RGBA，适合高保真纹理) 
     * 对应 DXGI_FORMAT_BC7_UNORM 
     */
    BC7_RGBA_UNORM: 'bc7-rgba-unorm',

    /** 
     * 11位浮点 HDR 格式 (紧凑浮点，适合快速 HDR 处理) 
     * 对应 DXGI_FORMAT_R11G11B10_FLOAT 
     */
    R11G11B10_FLOAT: 'r11g11b10float',

    /** 
     * 单通道 8 位标准化格式 
     * 对应 DXGI_FORMAT_R8_UNORM 
     */
    R8_UNORM: 'r8unorm',

    /** 
     * 单通道 16 位浮点格式 
     * 对应 DXGI_FORMAT_R16_FLOAT 
     */
    R16_FLOAT: 'r16float',

    /** 
     * 双通道 32 位浮点格式 
     * 对应 DXGI_FORMAT_R32G32_FLOAT 
     */
    RG32_FLOAT: 'rg32float',

    /** 
     * ASTC 压缩格式 (适合移动设备，高质量压缩) 
     * 不对应 DX 格式，支持平台为 OpenGL 或 Vulkan 
     */
    ASTC_4X4_UNORM: 'astc-4x4-unorm'
};


/**
 * GPU纹理资源基类
 */
class FTexture extends FRenderResource {
    /**
     * @param {GPUDevice} device - GPU设备
     * @param {Object} desc - 纹理描述符
     * @param {string} [desc.name] - 资源名称，用于调试和识别
     * @param {ETextureType} desc.type - 纹理类型
     * @param {ETextureFormat} desc.format - 纹理格式
     * @param {number} desc.width - 纹理宽度
     * @param {number} desc.height - 纹理高度
     * @param {number} [desc.depth=1] - 纹理深度（3D纹理）
     * @param {number} [desc.mipLevelCount=1] - Mipmap级别数
     * @param {number} [desc.sampleCount=1] - 采样数（MSAA）
     * @param {GPUTextureUsageFlags} [desc.usage] - 纹理用途标志
     * @inheritdoc
     */
    constructor(device, desc) {
        super(device, desc.name);

        /**
         * 纹理类型
         * @type {ETextureType}
         * @readonly
         */
        this.type = desc.type;

        /**
         * 纹理格式
         * @type {ETextureFormat}
         * @readonly
         */
        this.format = desc.format;

        /**
         * 纹理宽度
         * @type {number}
         * @readonly
         */
        this.width = desc.width;

        /**
         * 纹理高度
         * @type {number}
         * @readonly
         */
        this.height = desc.height;

        /**
         * 纹理深度
         * @type {number}
         * @readonly
         */
        this.depth = desc.depth || 1;

        /**
         * Mipmap级别数
         * @type {number}
         * @readonly
         */
        this.mipLevelCount = desc.mipLevelCount || 1;

        /**
         * 采样数（MSAA）
         * @type {number}
         * @readonly
         */
        this.sampleCount = desc.sampleCount || 1;

        /**
         * 纹理用途标志
         * @type {GPUTextureUsageFlags}
         * @readonly
         */
        this.usage = desc.usage || GPUTextureUsage.TEXTURE_BINDING;

        /**
         * 纹理视图
         * @type {GPUTextureView}
         * @protected
         */
        this._view = null;
    }

    /**
     * 初始化纹理
     * @override
     */
    async Initialize() {
        this._validateDevice();
        try {
            this._updateState('initializing');
            this._gpuResource = this.device.createTexture({
                size: {
                    width: this.width,
                    height: this.height,
                    depthOrArrayLayers: this.depth
                },
                format: this.format,
                usage: this.usage,
                mipLevelCount: this.mipLevelCount,
                sampleCount: this.sampleCount,
                dimension: this._getDimension()
            });
            this._createDefaultView();
            this._updateState('ready');
        } catch (error) {
            this._handleError(error);
        }
    }

    /**
     * 销毁纹理
     * @override
     */
    Destroy() {
        if (this._gpuResource) {
            this._gpuResource.destroy();
            this._gpuResource = null;
            this._view = null;
        }
        this._updateState('destroyed');
    }

    /**
     * 更新纹理数据
     * @override
     * @param {Object} params - 更新参数
     * @param {ArrayBuffer|ImageBitmap} params.data - 纹理数据
     * @param {GPUImageDataLayout} [params.layout] - 数据布局
     * @param {GPUExtent3D} [params.size] - 更新区域大小
     */
    async Update({ data, layout, size }) {
        if (!this.IsValid()) {
            throw new Error('Cannot update invalid texture');
        }

        try {
            if (data instanceof ImageBitmap) {
                this.device.queue.copyExternalImageToTexture(
                    { source: data },
                    { texture: this._gpuResource },
                    { width: this.width, height: this.height }
                );
            } else {
                this.device.queue.writeTexture(
                    { texture: this._gpuResource },
                    data,
                    layout || {},
                    size || { width: this.width, height: this.height, depthOrArrayLayers: 1 }
                );
            }
        } catch (error) {
            this._handleError(error);
        }
    }

    /**
     * 创建纹理视图
     * @param {GPUTextureViewDescriptor} [desc] - 视图描述符
     * @returns {GPUTextureView}
     */
    CreateView(desc = {}) {
        if (!this.IsValid()) {
            throw new Error('Cannot create view for invalid texture');
        }
        return this._gpuResource.createView(desc);
    }

    /**
     * 生成Mipmap
     * @abstract
     */
    GenerateMipmaps() {
        throw new Error('GenerateMipmaps() must be implemented by derived class');
    }

    /**
     * 获取纹理视图
     * @returns {GPUTextureView}
     */
    GetView() {
        return this._view;
    }

    /**
     * 获取纹理大小（字节）
     * @override
     * @returns {number}
     */
    GetSize() {
        const formatSize = this._getFormatSize();
        return this.width * this.height * this.depth * formatSize;
    }

    /**
     * 创建默认视图
     * @protected
     */
    _createDefaultView() {
        this._view = this._gpuResource.createView();
    }

    /**
     * 获取纹理维度
     * @protected
     * @returns {GPUTextureDimension}
     */
    _getDimension() {
        switch (this.type) {
            case ETextureType.TEXTURE_3D:
                return '3d';
            default:
                return '2d';
        }
    }

    /**
     * 获取格式大小（字节）
     * @protected
     * @returns {number}
     */
    _getFormatSize() {
        switch (this.format) {
            case ETextureFormat.RGBA8_UNORM:
                return 4;
            case ETextureFormat.RGBA16_FLOAT:
                return 8;
            case ETextureFormat.RGBA32_FLOAT:
                return 16;
            case ETextureFormat.DEPTH24_PLUS:
            case ETextureFormat.DEPTH32_FLOAT:
                return 4;
            default:
                return 4;
        }
    }
}

export default FTexture; 