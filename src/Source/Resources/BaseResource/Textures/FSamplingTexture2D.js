import FTexture2D, { ETexture2DUsage } from './FTexture2D';
import { ETextureFormat } from './FTexture';

/**
 * 采样纹理类
 * 用于常规纹理采样，如漫反射贴图、法线贴图等
 */
class FSamplingTexture2D extends FTexture2D {
    /**
     * @param {GPUDevice} device - GPU设备
     * @param {Object} desc - 纹理描述符
     * @param {string} [desc.name] - 资源名称
     * @param {ETextureFormat} [desc.format=ETextureFormat.RGBA8_UNORM] - 纹理格式
     * @param {number} desc.width - 纹理宽度
     * @param {number} desc.height - 纹理高度
     * @param {number} [desc.mipLevelCount] - Mipmap级别数（自动计算）
     * @param {boolean} [desc.generateMips=true] - 是否生成Mipmap
     * @inheritdoc
     */
    constructor(device, desc) {
        // 计算最大mipmap级别
        const maxMipLevel = desc.generateMips !== false ? 
            Math.floor(Math.log2(Math.max(desc.width, desc.height))) + 1 : 1;

        super(device, {
            ...desc,
            usage: ETexture2DUsage.SAMPLING | ETexture2DUsage.PRESENT,
            mipLevelCount: desc.mipLevelCount || maxMipLevel,
            generateMips: desc.generateMips !== false
        });
    }

    /**
     * 创建标准RGBA8纹理
     * @static
     * @param {GPUDevice} device - GPU设备
     * @param {number} width - 宽度
     * @param {number} height - 高度
     * @param {Object} [options] - 其他选项
     * @param {boolean} [options.generateMips=true] - 是否生成Mipmap
     * @returns {Promise<FSamplingTexture2D>}
     */
    static async CreateRGBA8(device, width, height, options = {}) {
        const texture = new FSamplingTexture2D(device, {
            width,
            height,
            format: ETextureFormat.RGBA8_UNORM,
            generateMips: options.generateMips
        });
        await texture.Initialize();
        return texture;
    }

    /**
     * 创建HDR纹理
     * @static
     * @param {GPUDevice} device - GPU设备
     * @param {number} width - 宽度
     * @param {number} height - 高度
     * @param {Object} [options] - 其他选项
     * @param {boolean} [options.generateMips=true] - 是否生成Mipmap
     * @param {boolean} [options.highPrecision=false] - 是否使用高精度格式
     * @returns {Promise<FSamplingTexture2D>}
     */
    static async CreateHDR(device, width, height, options = {}) {
        const format = options.highPrecision ? 
            ETextureFormat.RGBA32_FLOAT : 
            ETextureFormat.RGBA16_FLOAT;

        const texture = new FSamplingTexture2D(device, {
            width,
            height,
            format,
            generateMips: options.generateMips
        });
        await texture.Initialize();
        return texture;
    }

    /**
     * 创建法线贴图
     * @static
     * @param {GPUDevice} device - GPU设备
     * @param {number} width - 宽度
     * @param {number} height - 高度
     * @param {Object} [options] - 其他选项
     * @param {boolean} [options.generateMips=true] - 是否生成Mipmap
     * @returns {Promise<FSamplingTexture2D>}
     */
    static async CreateNormalMap(device, width, height, options = {}) {
        const texture = new FSamplingTexture2D(device, {
            width,
            height,
            format: ETextureFormat.RGBA8_UNORM,
            generateMips: options.generateMips
        });
        await texture.Initialize();
        return texture;
    }

    /**
     * 创建压缩纹理
     * @static
     * @param {GPUDevice} device - GPU设备
     * @param {number} width - 宽度
     * @param {number} height - 高度
     * @param {ETextureFormat} format - 压缩格式
     * @param {Object} [options] - 其他选项
     * @param {boolean} [options.generateMips=true] - 是否生成Mipmap
     * @returns {Promise<FSamplingTexture2D>}
     */
    static async CreateCompressed(device, width, height, format, options = {}) {
        const texture = new FSamplingTexture2D(device, {
            width,
            height,
            format,
            generateMips: options.generateMips
        });
        await texture.Initialize();
        return texture;
    }

    /**
     * 从图像URL创建纹理
     * @static
     * @param {GPUDevice} device - GPU设备
     * @param {string} url - 图像URL
     * @param {Object} [options] - 其他选项
     * @param {boolean} [options.generateMips=true] - 是否生成Mipmap
     * @returns {Promise<FSamplingTexture2D>}
     */
    static async FromURL(device, url, options = {}) {
        const img = new Image();
        img.src = url;
        await img.decode();

        const texture = new FSamplingTexture2D(device, {
            width: img.width,
            height: img.height,
            generateMips: options.generateMips
        });
        await texture.Initialize();
        await texture.LoadFromImage(img);
        return texture;
    }

    /**
     * 从Canvas创建纹理
     * @static
     * @param {GPUDevice} device - GPU设备
     * @param {HTMLCanvasElement} canvas - Canvas元素
     * @param {Object} [options] - 其他选项
     * @param {boolean} [options.generateMips=true] - 是否生成Mipmap
     * @returns {Promise<FSamplingTexture2D>}
     */
    static async FromCanvas(device, canvas, options = {}) {
        const texture = new FSamplingTexture2D(device, {
            width: canvas.width,
            height: canvas.height,
            generateMips: options.generateMips
        });
        await texture.Initialize();
        await texture.LoadFromCanvas(canvas);
        return texture;
    }
}

export default FSamplingTexture2D; 