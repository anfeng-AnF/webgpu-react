import FTexture2D, { ETexture2DUsage } from './FTexture2D';
import { ETextureFormat } from './FTexture';

/**
 * GBuffer类型枚举
 * @readonly
 * @enum {string}
 */
export const EGBufferType = {
    /** 
     * GBuffer A: 世界法线 (RGB)
     * RGB: 法线
     */
    GBUFFER_A: 'gbuffer_a',

    /** 
     * GBuffer B: 材质属性 (RGBA8888)
     * R: 金属度
     * G: 高光
     * B: 粗糙度
     * A: ShadingModelID + SelectiveOutputMask
     */
    GBUFFER_B: 'gbuffer_b',

    /** 
     * GBuffer C: 基础颜色 (RGB)
     * RGB: BaseColor
     */
    GBUFFER_C: 'gbuffer_c',

    /** 
     * GBuffer D: 自定义数据
     * 用于存储自定义渲染数据
     */
    GBUFFER_D: 'gbuffer_d',

    /** 
     * GBuffer E: 静态阴影
     * 用于存储静态阴影数据
     */
    GBUFFER_E: 'gbuffer_e',

    /** 
     * GBuffer F: 切线
     * 用于存储表面切线数据
     */
    GBUFFER_F: 'gbuffer_f',

    /** 
     * 速度缓冲: 用于动态模糊等效果
     * RG: 速度向量 (2D)
     */
    VELOCITY: 'velocity',

    /** 
     * 自定义GBuffer
     * 用于扩展其他用途
     */
    CUSTOM: 'custom'
};

/**
 * GBuffer纹理类
 * 用于延迟渲染
 */
export class FGBufferTexture2D extends FTexture2D {
    /**
     * @param {GPUDevice} device - GPU设备
     * @param {Object} desc - 纹理描述符
     * @param {string} [desc.name] - 资源名称
     * @param {EGBufferType} desc.bufferType - GBuffer类型
     * @param {ETextureFormat} [desc.format] - 纹理格式（可选，根据类型自动选择）
     * @param {number} desc.width - 纹理宽度
     * @param {number} desc.height - 纹理高度
     * @param {number} [desc.sampleCount=1] - MSAA采样数
     * @inheritdoc
     */
    constructor(device, desc) {
        const format = desc.format || FGBufferTexture2D.GetDefaultFormat(desc.bufferType);
        const usage = ETexture2DUsage.RENDER_TARGET | 
                     ETexture2DUsage.TEXTURE_BINDING | 
                     ETexture2DUsage.STORAGE_BINDING;

        super(device, {
            ...desc,
            format,
            usage
        });

        /**
         * GBuffer类型
         * @type {EGBufferType}
         * @readonly
         */
        this.bufferType = desc.bufferType;
    }

    /**
     * 获取默认格式
     * @static
     * @param {EGBufferType} bufferType - GBuffer类型
     * @returns {ETextureFormat}
     */
    static GetDefaultFormat(bufferType) {
        switch (bufferType) {
            case EGBufferType.GBUFFER_A:
                // 世界法线需要高精度
                return ETextureFormat.RGBA16_FLOAT;
            case EGBufferType.GBUFFER_B:
                // 金属度，高光，粗糙度，ShadingModelID+SelectiveOutputMask
                return ETextureFormat.RGBA8_UNORM;
            case EGBufferType.GBUFFER_C:
                // BaseColor
                return ETextureFormat.RGBA8_UNORM;
            case EGBufferType.GBUFFER_D:
                // 自定义数据
                return ETextureFormat.RGBA8_UNORM;
            case EGBufferType.GBUFFER_E:
                // 静态阴影
                return ETextureFormat.R8_UNORM;
            case EGBufferType.GBUFFER_F:
                // 切线
                return ETextureFormat.RGBA16_FLOAT;
            case EGBufferType.VELOCITY:
                // 速度缓冲
                return ETextureFormat.RG16_FLOAT;
            default:
                return ETextureFormat.RGBA8_UNORM;
        }
    }

    /**
     * 创建存储视图
     * @returns {GPUTextureView}
     */
    CreateStorageView() {
        return this.CreateView({
            format: this.format,
            dimension: '2d',
            aspect: 'all',
            baseMipLevel: 0,
            mipLevelCount: 1
        });
    }

    /**
     * 创建渲染目标视图
     * @returns {GPUTextureView}
     */
    CreateRenderTargetView() {
        return this.CreateView({
            format: this.format,
            dimension: '2d',
            aspect: 'all',
            baseMipLevel: 0,
            mipLevelCount: 1
        });
    }

    /**
     * 创建标准GBuffer
     * @static
     * @param {GPUDevice} device - GPU设备
     * @param {number} width - 宽度
     * @param {number} height - 高度
     * @param {EGBufferType} bufferType - GBuffer类型
     * @param {Object} [options] - 其他选项
     * @param {number} [options.sampleCount] - MSAA采样数
     * @returns {Promise<FGBufferTexture2D>}
     */
    static async Create(device, width, height, bufferType, options = {}) {
        const texture = new FGBufferTexture2D(device, {
            width,
            height,
            bufferType,
            sampleCount: options.sampleCount
        });
        await texture.Initialize();
        return texture;
    }
}

export default FGBufferTexture2D; 