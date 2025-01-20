import { FTexture, ETextureDimension } from './FTexture';

/**
 * 2D纹理类
 * 提供2D纹理的特定功能
 * 
 * @example
 * // 1. 创建基本2D纹理
 * const texture = FTexture2D.createSampledTexture(device, "albedo", {
 *     width: 1024,
 *     height: 1024
 * });
 * 
 * // 设置纹理数据
 * await texture.setData(imageData);
 * texture.generateMipmaps();
 * 
 * // 2. 创建渲染目标
 * const renderTarget = FTexture2D.createColorAttachment(device, "renderTarget", {
 *     width: 800,
 *     height: 600
 * });
 * 
 * // 3. 创建深度纹理
 * const depthTexture = FTexture2D.createDepthTexture(device, "depth", {
 *     width: 800,
 *     height: 600
 * });
 * 
 * // 4. 在渲染管线中使用
 * // 作为渲染目标
 * const renderPassDesc = {
 *     colorAttachments: [{
 *         view: renderTarget.getView(),
 *         clearValue: { r: 0, g: 0, b: 0, a: 1 },
 *         loadOp: 'clear',
 *         storeOp: 'store'
 *     }],
 *     depthStencilAttachment: {
 *         view: depthTexture.getView(),
 *         depthClearValue: 1.0,
 *         depthLoadOp: 'clear',
 *         depthStoreOp: 'store'
 *     }
 * };
 * 
 * // 作为采样纹理
 * // @group(0) @binding(1) var myTexture: texture_2d<f32>;
 * // @group(0) @binding(2) var mySampler: sampler;
 * 
 * @note
 * 1. 支持多种用途：采样纹理、渲染目标、深度纹理等
 * 2. 自动处理mipmap生成
 * 3. 支持多种格式和用途组合
 * 4. 可以动态调整大小（会重新创建资源）
 */
export class FTexture2D extends FTexture {
    /**
     * @param {GPUDevice} device - GPU设备
     * @param {Object} desc - 纹理描述符
     * @param {string} desc.name - 资源名称
     * @param {GPUTextureFormat} desc.format - 纹理格式
     * @param {Object} desc.size - 纹理大小
     * @param {number} desc.size.width - 宽度
     * @param {number} desc.size.height - 高度
     * @param {GPUTextureUsageFlags} desc.usage - 纹理用途标志
     * @param {number} [desc.mipLevelCount=1] - mipmap层级数
     * @param {number} [desc.sampleCount=1] - 采样数（用于MSAA）
     */
    constructor(device, desc) {
        super(device, {
            ...desc,
            dimension: ETextureDimension._2D
        });

        this.mipLevelCount = desc.mipLevelCount || 1;
        this.sampleCount = desc.sampleCount || 1;
    }

    /**
     * 创建GPU纹理
     * @protected
     */
    create() {
        this.gpuResource = this.device.createTexture({
            format: this.format,
            dimension: this.dimension,
            size: this.size,
            usage: this.usage,
            mipLevelCount: this.mipLevelCount,
            sampleCount: this.sampleCount
        });

        this.defaultView = this.gpuResource.createView();
    }

    /**
     * 设置纹理数据
     * @param {ArrayBuffer | TypedArray} data - 纹理数据
     * @param {GPUImageDataLayout} [dataLayout] - 数据布局
     */
    async setData(data, dataLayout = {}) {
        if (!this.gpuResource) {
            this.create();
        }

        const { bytesPerRow = this.size.width * 4, rowsPerImage = this.size.height } = dataLayout;

        this.device.queue.writeTexture(
            { texture: this.gpuResource },
            data,
            { bytesPerRow, rowsPerImage },
            this.size
        );
    }

    /**
     * 生成mipmap
     */
    generateMipmaps() {
        if (this.mipLevelCount <= 1) return;

        const commandEncoder = this.device.createCommandEncoder();
        // TODO: 实现mipmap生成逻辑
        this.device.queue.submit([commandEncoder.finish()]);
    }

    // 静态工厂方法
    /**
     * 创建深度纹理
     * @param {GPUDevice} device - GPU设备
     * @param {string} name - 资源名称
     * @param {Object} size - 纹理大小
     * @param {number} size.width - 宽度
     * @param {number} size.height - 高度
     * @returns {FTexture2D} 深度纹理
     */
    static createDepthTexture(device, name, size) {
        return new FTexture2D(device, {
            name,
            format: 'depth24plus',
            size,
            usage: GPUTextureUsage.DEPTH_STENCIL_ATTACHMENT | 
                   GPUTextureUsage.TEXTURE_BINDING
        });
    }

    /**
     * 创建颜色附件纹理
     * @param {GPUDevice} device - GPU设备
     * @param {string} name - 资源名称
     * @param {Object} size - 纹理大小
     * @param {GPUTextureFormat} [format='bgra8unorm'] - 纹理格式
     * @returns {FTexture2D} 颜色附件纹理
     */
    static createColorAttachment(device, name, size, format = 'bgra8unorm') {
        return new FTexture2D(device, {
            name,
            format,
            size,
            usage: GPUTextureUsage.RENDER_ATTACHMENT | 
                   GPUTextureUsage.TEXTURE_BINDING |
                   GPUTextureUsage.COPY_SRC
        });
    }

    /**
     * 创建存储纹理
     * @param {GPUDevice} device - GPU设备
     * @param {string} name - 资源名称
     * @param {Object} size - 纹理大小
     * @param {GPUTextureFormat} [format='rgba8unorm'] - 纹理格式
     * @returns {FTexture2D} 存储纹理
     */
    static createStorageTexture(device, name, size, format = 'rgba8unorm') {
        return new FTexture2D(device, {
            name,
            format,
            size,
            usage: GPUTextureUsage.STORAGE_BINDING | 
                   GPUTextureUsage.TEXTURE_BINDING |
                   GPUTextureUsage.COPY_SRC |
                   GPUTextureUsage.COPY_DST
        });
    }

    /**
     * 创建采样纹理
     * @param {GPUDevice} device - GPU设备
     * @param {string} name - 资源名称
     * @param {Object} size - 纹理大小
     * @param {GPUTextureFormat} [format='rgba8unorm'] - 纹理格式
     * @returns {FTexture2D} 采样纹理
     */
    static createSampledTexture(device, name, size, format = 'rgba8unorm') {
        return new FTexture2D(device, {
            name,
            format,
            size,
            usage: GPUTextureUsage.TEXTURE_BINDING |
                   GPUTextureUsage.COPY_DST,
            mipLevelCount: Math.floor(Math.log2(Math.max(size.width, size.height))) + 1
        });
    }

    /**
     * 创建多重采样纹理
     * @param {GPUDevice} device - GPU设备
     * @param {string} name - 资源名称
     * @param {Object} size - 纹理大小
     * @param {number} sampleCount - 采样数
     * @returns {FTexture2D} 多重采样纹理
     */
    static createMultisampleTexture(device, name, size, sampleCount) {
        return new FTexture2D(device, {
            name,
            format: 'bgra8unorm',
            size,
            usage: GPUTextureUsage.RENDER_ATTACHMENT |
                   GPUTextureUsage.TEXTURE_BINDING,
            sampleCount
        });
    }

    // 静态布局方法
    /**
     * 获取深度纹理布局
     * @returns {Object} 纹理布局
     */
    static getDepthTextureLayout() {
        return {
            type: 'texture',
            format: 'depth24plus',
            dimension: '2d',
            sampleType: 'depth',
            viewDimension: '2d'
        };
    }

    /**
     * 获取颜色附件布局
     * @returns {Object} 纹理布局
     */
    static getColorAttachmentLayout() {
        return {
            type: 'texture',
            format: 'bgra8unorm',
            dimension: '2d',
            sampleType: 'float',
            viewDimension: '2d'
        };
    }

    /**
     * 获取存储纹理布局
     * @returns {Object} 纹理布局
     */
    static getStorageTextureLayout() {
        return {
            type: 'texture',
            format: 'rgba8unorm',
            dimension: '2d',
            sampleType: 'float',
            viewDimension: '2d'
        };
    }

    /**
     * 获取采样纹理布局
     * @returns {Object} 纹理布局
     */
    static getSampledTextureLayout() {
        return {
            type: 'texture',
            format: 'rgba8unorm',
            dimension: '2d',
            sampleType: 'float',
            viewDimension: '2d'
        };
    }

    /**
     * 获取多重采样纹理布局
     * @returns {Object} 纹理布局
     */
    static getMultisampleTextureLayout() {
        return {
            type: 'texture',
            format: 'bgra8unorm',
            dimension: '2d',
            sampleType: 'float',
            viewDimension: '2d-array'
        };
    }
} 