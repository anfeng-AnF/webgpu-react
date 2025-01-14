import FTexture, { ETextureType, ETextureFormat } from './FTexture';

/**
 * 3D纹理类
 * 用于体积渲染、3D噪声等
 */
class FTexture3D extends FTexture {
    /**
     * @param {GPUDevice} device - GPU设备
     * @param {Object} desc - 3D纹理描述符
     * @param {string} [desc.name] - 资源名称
     * @param {ETextureFormat} [desc.format=ETextureFormat.RGBA8_UNORM] - 纹理格式
     * @param {number} desc.width - 纹理宽度
     * @param {number} desc.height - 纹理高度
     * @param {number} desc.depth - 纹理深度
     * @param {number} [desc.mipLevelCount=1] - Mipmap级别数
     * @param {GPUTextureUsageFlags} [desc.usage] - 额外的用途标志
     * @inheritdoc
     */
    constructor(device, desc) {
        const format = desc.format || ETextureFormat.RGBA8_UNORM;
        const usage = (desc.usage || 0) |
            GPUTextureUsage.TEXTURE_BINDING |
            GPUTextureUsage.COPY_DST;

        if (!desc.depth || desc.depth < 1) {
            throw new Error('3D texture requires a valid depth value');
        }

        super(device, {
            ...desc,
            type: ETextureType.TEXTURE_3D,
            format,
            usage
        });

        /**
         * 每个体素的字节数
         * @type {number}
         * @private
         */
        this._bytesPerVoxel = this._getFormatSize();

        /**
         * 每层的字节数
         * @type {number}
         * @private
         */
        this._bytesPerLayer = this.width * this.height * this._bytesPerVoxel;
    }

    /**
     * 更新3D纹理数据
     * @override
     * @param {Object} params - 更新参数
     * @param {ArrayBuffer} params.data - 体素数据
     * @param {GPUImageDataLayout} [params.layout] - 数据布局
     * @param {GPUExtent3D} [params.size] - 更新区域大小
     */
    async Update({ data, layout = {}, size = null }) {
        if (!this.IsValid()) {
            throw new Error('Cannot update invalid 3D texture');
        }

        try {
            const defaultLayout = {
                bytesPerRow: this.width * this._bytesPerVoxel,
                rowsPerImage: this.height
            };

            const defaultSize = {
                width: this.width,
                height: this.height,
                depthOrArrayLayers: this.depth
            };

            this.device.queue.writeTexture(
                { texture: this._gpuResource },
                data,
                { ...defaultLayout, ...layout },
                size || defaultSize
            );
        } catch (error) {
            this._handleError(error);
        }
    }

    /**
     * 更新单个切片
     * @param {Object} params - 更新参数
     * @param {ArrayBuffer} params.data - 切片数据
     * @param {number} params.z - Z坐标（切片索引）
     * @param {GPUImageDataLayout} [params.layout] - 数据布局
     * @param {Object} [params.size] - 更新区域大小
     */
    async UpdateSlice({ data, z, layout = {}, size = null }) {
        if (z < 0 || z >= this.depth) {
            throw new Error('Invalid slice index');
        }

        const defaultLayout = {
            bytesPerRow: this.width * this._bytesPerVoxel,
            rowsPerImage: this.height
        };

        const defaultSize = {
            width: this.width,
            height: this.height,
            depthOrArrayLayers: 1
        };

        await this.Update({
            data,
            layout: { ...defaultLayout, ...layout },
            size: size || defaultSize,
            destination: {
                texture: this._gpuResource,
                origin: { x: 0, y: 0, z }
            }
        });
    }

    /**
     * 创建3D纹理视图
     * @override
     * @param {GPUTextureViewDescriptor} [desc] - 视图描述符
     * @returns {GPUTextureView}
     */
    CreateView(desc = {}) {
        if (!this.IsValid()) {
            throw new Error('Cannot create view for invalid 3D texture');
        }

        return this._gpuResource.createView({
            dimension: '3d',
            format: this.format,
            ...desc
        });
    }

    /**
     * 生成Mipmap
     * @override
     */
    async GenerateMipmaps() {
        if (!this.IsValid() || this.mipLevelCount <= 1) {
            return;
        }

        // 需要实现3D纹理的Mipmap生成
        // 这通常需要计算着色器来完成
        throw new Error('3D texture mipmap generation not implemented');
    }

    /**
     * 创建3D噪声纹理
     * @static
     * @param {GPUDevice} device - GPU设备
     * @param {number} size - 纹理大小 (size x size x size)
     * @param {Object} [options] - 其他选项
     * @param {ETextureFormat} [options.format] - 纹理格式
     * @param {Function} [options.noiseFunction] - 噪声生成函数
     * @returns {Promise<FTexture3D>}
     */
    static async CreateNoise(device, size, options = {}) {
        const texture = new FTexture3D(device, {
            width: size,
            height: size,
            depth: size,
            format: options.format || ETextureFormat.R8_UNORM
        });

        await texture.Initialize();

        if (options.noiseFunction) {
            const data = new Uint8Array(size * size * size);
            for (let z = 0; z < size; z++) {
                for (let y = 0; y < size; y++) {
                    for (let x = 0; x < size; x++) {
                        const index = (z * size * size) + (y * size) + x;
                        data[index] = options.noiseFunction(x, y, z) * 255;
                    }
                }
            }
            await texture.Update({ data });
        }

        return texture;
    }

    /**
     * 创建体素数据纹理
     * @static
     * @param {GPUDevice} device - GPU设备
     * @param {number} width - 宽度
     * @param {number} height - 高度
     * @param {number} depth - 深度
     * @param {Object} [options] - 其他选项
     * @param {ETextureFormat} [options.format] - 纹理格式
     * @returns {Promise<FTexture3D>}
     */
    static async CreateVolumeData(device, width, height, depth, options = {}) {
        const texture = new FTexture3D(device, {
            width,
            height,
            depth,
            format: options.format || ETextureFormat.RGBA8_UNORM
        });

        await texture.Initialize();
        return texture;
    }
}

export default FTexture3D; 