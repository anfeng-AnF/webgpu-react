import { FResource } from '../FResource';

/**
 * 纹理维度枚举
 * @enum {string}
 */
export const ETextureDimension = {
    _1D: '1d',
    _2D: '2d',
    _3D: '3d',
    CUBE: 'cube'
};

/**
 * 纹理资源基类
 * 所有纹理类型的基类，提供基本的纹理功能
 * 
 * @example
 * // 通常不直接使用FTexture，而是使用其子类
 * class FCustomTexture extends FTexture {
 *     constructor(device, desc) {
 *         super(device, {
 *             ...desc,
 *             dimension: ETextureDimension._2D
 *         });
 *     }
 * 
 *     // 实现特定的纹理功能
 *     setCustomData(data) {
 *         // 自定义数据设置逻辑
 *     }
 * }
 * 
 * @note
 * 1. 提供纹理基本属性管理：格式、维度、大小等
 * 2. 自动处理纹理视图创建
 * 3. 支持多种纹理维度：1D、2D、3D、Cube
 * 4. 子类需要实现具体的数据操作方法
 */
export class FTexture extends FResource {
    /**
     * @param {GPUDevice} device - GPU设备
     * @param {Object} desc - 纹理描述符
     * @param {string} desc.name - 资源名称
     * @param {GPUTextureFormat} desc.format - 纹理格式
     * @param {ETextureDimension} desc.dimension - 纹理维度
     * @param {Object} desc.size - 纹理大小
     * @param {number} desc.size.width - 宽度
     * @param {number} desc.size.height - 高度
     * @param {number} [desc.size.depthOrArrayLayers] - 深度或数组层数
     * @param {GPUTextureUsageFlags} desc.usage - 纹理用途标志
     */
    constructor(device, desc) {
        super(device, desc);
        
        this.format = desc.format;
        this.dimension = desc.dimension;
        this.size = { ...desc.size };
        this.usage = desc.usage;
        this.defaultView = null;
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
            usage: this.usage
        });

        // 创建默认视图
        this.defaultView = this.gpuResource.createView();
    }

    /**
     * 调整纹理大小
     * @param {Object} newSize - 新的大小
     * @param {number} newSize.width - 新的宽度
     * @param {number} newSize.height - 新的高度
     * @param {number} [newSize.depthOrArrayLayers] - 新的深度或数组层数
     */
    resize(newSize) {
        if (!this.validateSize(newSize)) {
            throw new Error('Invalid texture size');
        }

        // 销毁旧资源
        if (this.gpuResource) {
            this.gpuResource.destroy();
            this.gpuResource = null;
            this.defaultView = null;
        }

        this.size = { ...newSize };
        this.create();
    }

    /**
     * 设置纹理数据
     * @param {ArrayBuffer | TypedArray} data - 纹理数据
     * @param {GPUImageDataLayout} [dataLayout] - 数据布局
     */
    async setData(data, dataLayout = {}) {
        throw new Error('setData() must be implemented by subclass');
    }

    /**
     * 获取纹理视图
     * @param {GPUTextureViewDescriptor} [desc] - 视图描述符
     * @returns {GPUTextureView} 纹理视图
     */
    getView(desc) {
        if (!this.gpuResource) {
            this.create();
        }
        return desc ? this.gpuResource.createView(desc) : this.defaultView;
    }

    /**
     * 获取纹理格式
     * @returns {GPUTextureFormat} 纹理格式
     */
    getFormat() {
        return this.format;
    }

    /**
     * 获取纹理维度
     * @returns {ETextureDimension} 纹理维度
     */
    getDimension() {
        return this.dimension;
    }

    /**
     * 获取纹理大小
     * @returns {Object} 纹理大小
     */
    getSize() {
        return { ...this.size };
    }

    /**
     * 获取纹理布局
     * @returns {Object} 纹理布局描述符
     */
    getLayout() {
        return {
            type: 'texture',
            format: this.format,
            dimension: this.dimension,
            sampleType: this.getSampleType(),
            viewDimension: this.getViewDimension()
        };
    }

    /**
     * 获取采样类型
     * @protected
     * @returns {GPUTextureSampleType} 采样类型
     */
    getSampleType() {
        // 根据格式确定采样类型
        if (this.format.includes('depth')) {
            return 'depth';
        } else if (this.format.includes('uint')) {
            return 'uint';
        } else if (this.format.includes('sint')) {
            return 'sint';
        }
        return 'float';
    }

    /**
     * 获取视图维度
     * @protected
     * @returns {GPUTextureViewDimension} 视图维度
     */
    getViewDimension() {
        switch (this.dimension) {
            case ETextureDimension._1D:
                return '1d';
            case ETextureDimension._2D:
                return '2d';
            case ETextureDimension._3D:
                return '3d';
            case ETextureDimension.CUBE:
                return 'cube';
            default:
                return '2d';
        }
    }

    /**
     * 验证纹理描述符
     * @protected
     * @returns {boolean} 验证结果
     */
    validateDesc() {
        return (
            super.validateDesc() &&
            typeof this.format === 'string' &&
            Object.values(ETextureDimension).includes(this.dimension) &&
            this.validateSize(this.size) &&
            typeof this.usage === 'number' &&
            this.usage !== 0
        );
    }

    /**
     * 验证纹理大小
     * @protected
     * @param {Object} size - 要验证的大小
     * @returns {boolean} 验证结果
     */
    validateSize(size) {
        const isPowerOf2 = (n) => n && (n & (n - 1)) === 0;
        
        return (
            size &&
            typeof size.width === 'number' &&
            size.width > 0 &&
            isPowerOf2(size.width) &&
            typeof size.height === 'number' &&
            size.height > 0 &&
            isPowerOf2(size.height) &&
            (this.dimension !== ETextureDimension._3D || (
                typeof size.depthOrArrayLayers === 'number' &&
                size.depthOrArrayLayers > 0 &&
                isPowerOf2(size.depthOrArrayLayers)
            ))
        );
    }

    /**
     * 销毁资源
     */
    destroy() {
        this.defaultView = null;
        super.destroy();
    }
} 