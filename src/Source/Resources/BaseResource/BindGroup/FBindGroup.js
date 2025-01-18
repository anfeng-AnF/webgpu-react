import { FRenderResource } from '../FRenderResource';
export { FBindGroupLayout } from './FBindGroupLayout';

/**
 * 绑定资源描述符
 * @typedef {Object} BindingResource
 * @property {number} binding - 绑定点索引
 * @property {GPUBuffer|GPUSampler|GPUTextureView} resource - 绑定资源
 * @property {number} [offset=0] - 缓冲区偏移（仅用于缓冲区）
 * @property {number} [size] - 缓冲区大小（仅用于缓冲区）
 */

/**
 * 绑定组类
 */
export class FBindGroup extends FRenderResource {
    /**
     * @param {GPUDevice} device - GPU设备
     * @param {Object} desc - 绑定组描述符
     * @param {string} [desc.name] - 资源名称
     * @param {FBindGroupLayout} desc.layout - 绑定组布局
     * @param {BindingResource[]} desc.entries - 绑定资源条目数组
     */
    constructor(device, desc) {
        super(device, desc.name);

        /**
         * 绑定组布局
         * @type {FBindGroupLayout}
         * @readonly
         */
        this.layout = desc.layout;

        /**
         * 绑定资源条目数组
         * @type {BindingResource[]}
         * @readonly
         */
        this.entries = desc.entries;

        /**
         * GPU绑定组对象
         * @type {GPUBindGroup}
         * @private
         */
        this._gpuBindGroup = null;

        // 创建绑定组
        this._createBindGroup();
    }

    /**
     * 创建GPU绑定组
     * @private
     */
    _createBindGroup() {
        const entries = this.entries.map(entry => {
            const layoutEntry = this.layout.entries.find(e => e.binding === entry.binding);
            if (!layoutEntry) {
                throw new Error(`No layout entry found for binding ${entry.binding}`);
            }

            const baseEntry = {
                binding: entry.binding
            };

            // 根据布局条目类型处理资源
            switch (layoutEntry.type) {
                case 'uniform':
                case 'storage':
                case 'read-only-storage':
                    if (!entry.resource.size) {
                        return {
                            ...baseEntry,
                            resource: {
                                buffer: entry.resource,
                                offset: entry.offset ?? 0,
                                size: entry.size ?? entry.resource.size
                            }
                        };
                    }
                    return {
                        ...baseEntry,
                        resource: entry.resource
                    };

                case 'sampler':
                case 'comparison':
                case 'sampled-texture':
                case 'storage-texture':
                case 'read-only-storage-texture':
                    return {
                        ...baseEntry,
                        resource: entry.resource
                    };

                default:
                    throw new Error(`Unknown binding type: ${layoutEntry.type}`);
            }
        });
        console.log({
            layout: this.layout.getGPUBindGroupLayout(),
            entries
        })
        this._gpuBindGroup = this.device.createBindGroup({
            layout: this.layout.getGPUBindGroupLayout(),
            entries
        });
    }

    /**
     * 获取GPU绑定组对象
     * @returns {GPUBindGroup}
     */
    getGPUBindGroup() {
        return this._gpuBindGroup;
    }

    /**
     * 更新绑定资源
     * @param {number} binding - 绑定点索引
     * @param {GPUBuffer|GPUSampler|GPUTextureView} resource - 新的绑定资源
     * @param {number} [offset=0] - 缓冲区偏移（仅用于缓冲区）
     * @param {number} [size] - 缓冲区大小（仅用于缓冲区）
     */
    updateBinding(binding, resource, offset = 0, size) {
        const entryIndex = this.entries.findIndex(e => e.binding === binding);
        if (entryIndex === -1) {
            throw new Error(`No binding found at index ${binding}`);
        }

        this.entries[entryIndex] = {
            binding,
            resource,
            offset,
            size
        };

        // 重新创建绑定组
        this._createBindGroup();
    }

    /**
     * 销毁资源
     * @override
     */
    destroy() {
        this._gpuBindGroup = null;
        super.destroy();
    }
} 