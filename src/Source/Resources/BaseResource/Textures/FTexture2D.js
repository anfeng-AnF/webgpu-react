import FTexture, { ETextureType, ETextureFormat } from './FTexture';

/**
 * 2D纹理用途枚举
 * @readonly
 * @enum {number}
 */
export const ETexture2DUsage = {
    /** 用于采样的纹理 */
    SAMPLING: GPUTextureUsage.TEXTURE_BINDING,
    /** 渲染目标 */
    RENDER_TARGET: GPUTextureUsage.RENDER_ATTACHMENT,
    /** 存储绑定(计算着色器读写) */
    STORAGE_BINDING: GPUTextureUsage.STORAGE_BINDING,
    /** 显示用 */
    PRESENT: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST
};

/**
 * 2D纹理基类
 * 用于图像、渲染目标等
 */
export class FTexture2D extends FTexture {
    /**
     * @param {GPUDevice} device - GPU设备
     * @param {Object} desc - 2D纹理描述符
     * @param {string} [desc.name] - 资源名称
     * @param {ETextureFormat} [desc.format=ETextureFormat.RGBA8_UNORM] - 纹理格式
     * @param {number} desc.width - 纹理宽度
     * @param {number} desc.height - 纹理高度
     * @param {number} [desc.mipLevelCount=1] - Mipmap级别数
     * @param {number} [desc.sampleCount=1] - MSAA采样数
     * @param {ETexture2DUsage} [desc.usage=ETexture2DUsage.SAMPLING] - 纹理用途
     * @param {boolean} [desc.generateMips=false] - 是否生成Mipmap
     * @inheritdoc
     */
    constructor(device, desc) {
        const format = desc.format || ETextureFormat.RGBA8_UNORM;
        const usage = (desc.usage || ETexture2DUsage.SAMPLING) | GPUTextureUsage.COPY_DST;

        super(device, {
            ...desc,
            type: ETextureType.TEXTURE_2D,
            format,
            usage
        });

        /**
         * 是否生成Mipmap
         * @type {boolean}
         * @protected
         */
        this._generateMips = desc.generateMips || false;

        /**
         * 每像素字节数
         * @type {number}
         * @protected
         */
        this._bytesPerPixel = this._getFormatSize();

        /**
         * 行对齐字节数（默认为256字节对齐）
         * @type {number}
         * @protected
         */
        this._rowAlignment = 256;
    }

    /**
     * 从图像加载纹理
     * @param {HTMLImageElement} image - 图像元素
     * @returns {Promise<void>}
     */
    async LoadFromImage(image) {
        if (!this.IsValid()) {
            throw new Error('Cannot load image to invalid texture');
        }

        try {
            const bitmap = await createImageBitmap(image);
            await this.LoadFromBitmap(bitmap);
        } catch (error) {
            this._handleError(error);
        }
    }

    /**
     * 从位图加载纹理
     * @param {ImageBitmap} bitmap - 位图数据
     * @returns {Promise<void>}
     */
    async LoadFromBitmap(bitmap) {
        if (!this.IsValid()) {
            throw new Error('Cannot load bitmap to invalid texture');
        }

        try {
            this.device.queue.copyExternalImageToTexture(
                { source: bitmap },
                { texture: this._gpuResource },
                { width: this.width, height: this.height }
            );

            if (this._generateMips && this.mipLevelCount > 1) {
                await this.GenerateMipmaps();
            }
        } catch (error) {
            this._handleError(error);
        }
    }

    /**
     * 从URL加载纹理
     * @param {string} url - 图像URL
     * @returns {Promise<void>}
     */
    async LoadFromURL(url) {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const bitmap = await createImageBitmap(blob);
            await this.LoadFromBitmap(bitmap);
        } catch (error) {
            this._handleError(error);
        }
    }

    /**
     * 从Canvas加载纹理
     * @param {HTMLCanvasElement} canvas - Canvas元素
     * @returns {Promise<void>}
     */
    async LoadFromCanvas(canvas) {
        try {
            const bitmap = await createImageBitmap(canvas);
            await this.LoadFromBitmap(bitmap);
        } catch (error) {
            this._handleError(error);
        }
    }

    /**
     * 从原始数据创建纹理
     * @param {ArrayBuffer} data - 原始数据
     * @param {number} width - 宽度
     * @param {number} height - 高度
     * @returns {Promise<void>}
     */
    async CreateFromData(data, width, height) {
        if (width !== this.width || height !== this.height) {
            throw new Error('Data dimensions do not match texture dimensions');
        }

        const bytesPerRow = Math.ceil(width * this._bytesPerPixel / this._rowAlignment) * this._rowAlignment;

        await this.Update({
            data,
            layout: {
                bytesPerRow,
                rowsPerImage: height
            },
            size: {
                width,
                height,
                depthOrArrayLayers: 1
            }
        });

        if (this._generateMips && this.mipLevelCount > 1) {
            await this.GenerateMipmaps();
        }
    }

    /**
     * 调整纹理大小
     * @param {number} width - 新宽度
     * @param {number} height - 新高度
     * @returns {Promise<void>}
     */
    async ResizeTo(width, height) {
        if (width === this.width && height === this.height) {
            return;
        }
    
        this._validateDevice();
        
        try {
            this._updateState('initializing');
    
            // 创建新纹理
            const newTexture = this.device.createTexture({
                size: { width, height, depthOrArrayLayers: 1 },
                format: this.format,
                usage: this.usage,
                mipLevelCount: this.mipLevelCount,
                sampleCount: this.sampleCount
            });
    
            // 如果原纹理有效，复制内容
            if (this.IsValid()) {
                const encoder = this.device.createCommandEncoder();
                encoder.copyTextureToTexture(
                    { texture: this._gpuResource },
                    { texture: newTexture },
                    { width: Math.min(this.width, width), 
                      height: Math.min(this.height, height) }
                );
                this.device.queue.submit([encoder.finish()]);
            }
    
            // 销毁旧资源
            if (this._gpuResource) {
                this._gpuResource.destroy();
            }
    
            // 更新资源和属性
            this._gpuResource = newTexture;
            this.width = width;
            this.height = height;
            
            // 更新状态
            this._updateState('ready');
            // 重新创建默认视图
            this._createDefaultView();
    
    
            // 重新生成Mipmap
            if (this._generateMips && this.mipLevelCount > 1) {
                await this.GenerateMipmaps();
            }
        } catch (error) {
            this._handleError(error);
        }
    }
    /**
     * 生成Mipmap
     * @override
     */
    async GenerateMipmaps() {
        if (!this.IsValid() || this.mipLevelCount <= 1) {
            return;
        }

        const encoder = this.device.createCommandEncoder();
        encoder.copyTextureToTexture(
            { texture: this._gpuResource },
            { texture: this._gpuResource, mipLevel: 0 },
            { width: this.width, height: this.height }
        );
        this.device.queue.submit([encoder.finish()]);
    }

    /**
     * 创建2D纹理视图
     * @override
     * @param {GPUTextureViewDescriptor} [desc] - 视图描述符
     * @returns {GPUTextureView}
     */
    CreateView(desc = {}) {
        if (!this.IsValid()) {
            throw new Error('Cannot create view for invalid 2D texture');
        }

        return this._gpuResource.createView({
            dimension: '2d',
            format: this.format,
            ...desc
        });
    }
}

export default FTexture2D; 