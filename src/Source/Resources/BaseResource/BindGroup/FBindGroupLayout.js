import { FRenderResource } from '../FRenderResource';

/**
 * 绑定类型枚举
 * @readonly
 * @enum {string}
 */
export const EBindingType = {
    UNIFORM_BUFFER: 'uniform',
    STORAGE_BUFFER: 'storage',
    READONLY_STORAGE_BUFFER: 'read-only-storage',
    SAMPLER: 'sampler',
    COMPARISON_SAMPLER: 'comparison',
    SAMPLED_TEXTURE: 'sampled-texture',
    STORAGE_TEXTURE: 'storage-texture',
    READONLY_STORAGE_TEXTURE: 'read-only-storage-texture'
};

/**
 * 着色器可见性枚举
 * @readonly
 * @enum {number}
 */
export const EShaderStage = {
    VERTEX: 0x1,
    FRAGMENT: 0x2,
    COMPUTE: 0x4,
    ALL: 0x7
};

/**
 * 绑定布局条目描述符
 * @typedef {Object} BindGroupLayoutEntry
 * @property {number} binding - 绑定点索引
 * @property {EBindingType} type - 绑定类型
 * @property {EShaderStage} visibility - 着色器可见性
 * @property {boolean} [hasDynamicOffset=false] - 是否有动态偏移
 * @property {number} [minBindingSize=0] - 最小绑定大小（字节）
 * @property {boolean} [multisampled=false] - 是否多重采样（仅用于纹理）
 * @property {GPUTextureSampleType} [sampleType='float'] - 采样类型（仅用于纹理）
 * @property {GPUTextureViewDimension} [viewDimension='2d'] - 视图维度（仅用于纹理）
 */

/**
 * 绑定组布局类
 */
export class FBindGroupLayout extends FRenderResource {
    /**
     * @param {GPUDevice} device - GPU设备
     * @param {Object} desc - 绑定组布局描述符
     * @param {string} [desc.name] - 资源名称
     * @param {BindGroupLayoutEntry[]} desc.entries - 绑定布局条目数组
     */
    constructor(device, desc) {
        super(device, desc.name);

        /**
         * 绑定布局条目数组
         * @type {BindGroupLayoutEntry[]}
         * @readonly
         */
        this.entries = desc.entries;

        /**
         * GPU绑定组布局对象
         * @type {GPUBindGroupLayout}
         * @private
         */
        this._gpuBindGroupLayout = null;

        // 创建绑定组布局
        this._createBindGroupLayout();
    }

    /**
     * 创建GPU绑定组布局
     * @private
     */
    _createBindGroupLayout() {
        const entries = this.entries.map(entry => {
            const baseEntry = {
                binding: entry.binding,
                visibility: entry.visibility
            };

            // 根据绑定类型添加特定属性
            switch (entry.type) {
                case EBindingType.UNIFORM_BUFFER:
                case EBindingType.STORAGE_BUFFER:
                case EBindingType.READONLY_STORAGE_BUFFER:
                    return {
                        ...baseEntry,
                        buffer: {
                            type: entry.type,
                            hasDynamicOffset: entry.hasDynamicOffset ?? false,
                            minBindingSize: entry.minBindingSize ?? 0
                        }
                    };

                case EBindingType.SAMPLER:
                case EBindingType.COMPARISON_SAMPLER:
                    return {
                        ...baseEntry,
                        sampler: {
                            type: entry.type === EBindingType.COMPARISON_SAMPLER ? 'comparison' : 'filtering'
                        }
                    };

                case EBindingType.SAMPLED_TEXTURE:
                    return {
                        ...baseEntry,
                        texture: {
                            sampleType: entry.sampleType ?? 'float',
                            viewDimension: entry.viewDimension ?? '2d',
                            multisampled: entry.multisampled ?? false
                        }
                    };

                case EBindingType.STORAGE_TEXTURE:
                case EBindingType.READONLY_STORAGE_TEXTURE:
                    return {
                        ...baseEntry,
                        storageTexture: {
                            access: entry.type === EBindingType.READONLY_STORAGE_TEXTURE ? 'read-only' : 'write-only',
                            format: entry.format,
                            viewDimension: entry.viewDimension ?? '2d'
                        }
                    };

                default:
                    throw new Error(`Unknown binding type: ${entry.type}`);
            }
        });

        this._gpuBindGroupLayout = this.device.createBindGroupLayout({
            entries
        });
    }

    /**
     * 获取GPU绑定组布局对象
     * @returns {GPUBindGroupLayout}
     */
    getGPUBindGroupLayout() {
        return this._gpuBindGroupLayout;
    }

    /**
     * 销毁资源
     * @override
     */
    destroy() {
        this._gpuBindGroupLayout = null;
        super.destroy();
    }
} 