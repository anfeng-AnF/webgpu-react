// 资源类型枚举
const EResourceType = {
    Buffer: 'Buffer',
    Texture: 'Texture',
    BindGroup: 'BindGroup',
    BindGroupLayout: 'BindGroupLayout',
    PipelineLayout: 'PipelineLayout',
    RenderPipeline: 'RenderPipeline',
    ComputePipeline: 'ComputePipeline',
    Sampler: 'Sampler',
    ShaderModule: 'ShaderModule',
};

class FResourceManager {
    static #Instance;
    #Resources;
    #Device;
    #ResourceStats;
    #ResourceVersions;

    constructor() {
        if (FResourceManager.#Instance) {
            return FResourceManager.#Instance;
        }
        
        this.#Resources = new Map();
        this.#ResourceStats = new Map();
        this.#ResourceVersions = new Map();
        
        FResourceManager.#Instance = this;
    }

    /**
     * 获取资源管理器单例
     * @returns {FResourceManager} 资源管理器实例
     */
    static GetInstance() {
        if (!FResourceManager.#Instance) {
            FResourceManager.#Instance = new FResourceManager();
        }
        return FResourceManager.#Instance;
    }

    /**
     * 初始化资源管理器
     * @param {GPUDevice} InDevice WebGPU 设备实例
     */
    InitDevice(InDevice) {
        this.#Device = InDevice;
        this.CreatePlaceholderResource();
    }

    /**
     * 创建 GPU 资源
     * @param {string} InName 资源名称
     * @param {Object} InDesc 资源描述符
     * @param {EResourceType} InDesc.Type 资源类型
     * @param {Object} InDesc.desc GPU 资源描述符
     * @param {boolean} [InDesc.bReplace=false] 是否替换已存在的资源
     * @param {Object} [InDesc.Metadata] 资源元数据
     * @returns {GPUResource|null} 创建的 GPU 资源，失败返回 null
     */
    CreateResource(InName, InDesc) {
        if (!this.#Device) {
            throw new Error('Device not initialized');
        }

        const Version = (this.#ResourceVersions.get(InName) || 0) + 1;
        this.#ResourceVersions.set(InName, Version);

        if (this.#Resources.has(InName)) {
            this.DeleteResource(InName);
        }

        let Resource;
        try {
            switch (InDesc.Type) {
                case EResourceType.Buffer:
                    Resource = this.#Device.createBuffer(InDesc.desc);
                    break;
                case EResourceType.ShaderModule:
                    Resource = this.#Device.createShaderModule(InDesc.desc);
                    break;
                case EResourceType.RenderPipeline:
                    Resource = this.#Device.createRenderPipeline(InDesc.desc);
                    break;
                case EResourceType.Texture:
                    Resource = this.#Device.createTexture(InDesc.desc);
                    break;
                case EResourceType.BindGroup:
                    Resource = this.#Device.createBindGroup(InDesc.desc);
                    break;
                case EResourceType.BindGroupLayout:
                    Resource = this.#Device.createBindGroupLayout(InDesc.desc);
                    break;
                case EResourceType.PipelineLayout:
                    Resource = this.#Device.createPipelineLayout(InDesc.desc);
                    break;
                case EResourceType.ComputePipeline:
                    Resource = this.#Device.createComputePipeline(InDesc.desc);
                    break;
                case EResourceType.Sampler:
                    Resource = this.#Device.createSampler(InDesc.desc);
                    break;
                default:
                    throw new Error(`Unknown resource type: ${InDesc.Type}`);
            }
        } catch (Error) {
            console.error(`Failed to create resource "${InName}":`, Error);
            return null;
        }

        this.#Resources.set(InName, {
            Resource,
            Type: InDesc.Type,
            Descriptor: InDesc,
            CreatedAt: Date.now(),
            Version,
            Metadata: InDesc.Metadata || {},
            RefCount: 1
        });

        this.#UpdateResourceStats(InDesc.Type, 'Create');

        return Resource;
    }

    CreatePlaceholderResource() {
        const PlaceholderTextureDesc = {
            Type: EResourceType.Texture,
            desc: {
                size: [1, 1],
                format: 'rgba8unorm',
                usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
            }
        };
        const PlaceholderUniformBufferDesc = {
            Type: EResourceType.Buffer,
            desc: {
                size: 16,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            }
        };
        const PlaceholderStorageBufferDesc = {
            Type: EResourceType.Buffer,
            desc: {
                size: 16,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            }
        };
        const PlaceholderSamplerDesc = {
            Type: EResourceType.Sampler,
            desc: {
                magFilter: 'nearest',
                minFilter: 'nearest',
                mipmapFilter: 'nearest',
                addressModeU: 'clamp-to-edge',
                addressModeV: 'clamp-to-edge',
                addressModeW: 'clamp-to-edge',
            }
        };
        this.CreateResource('placeholder_Texture', PlaceholderTextureDesc);
        this.CreateResource('placeholder_UniformBuffer', PlaceholderUniformBufferDesc);
        this.CreateResource('placeholder_StorageBuffer', PlaceholderStorageBufferDesc);
        this.CreateResource('placeholder_Sampler', PlaceholderSamplerDesc);
    }


    GetResourceInfo(InName) {
        return this.#Resources.get(InName);
    }

    /**
     *
     * @param InName
     * @returns {GPUBuffer|GPUTexture|GPUBindGroup|null}
     * @private
     */
    GetResource(InName) {
        const Info = this.#Resources.get(InName);
        return Info ? Info.Resource : null;
    }

    UpdateResourceMetadata(InName, InMetadata) {
        const Info = this.#Resources.get(InName);
        if (Info) {
            Info.Metadata = { ...Info.Metadata, ...InMetadata };
            return true;
        }
        return false;
    }

    /**
     * 获取指定类型的资源
     * @param {string} InType - 资源类型
     * @returns {Map<string, Object>} 包含指定类型资源的 Map
     * @private
     */
    GetResourcesByType(InType) {
        const Resources = new Map();
        for (const [Name, Info] of this.#Resources) {
            if (Info.Type === InType) {
                Resources.set(Name, Info);
            }
        }
        return Resources;
    }

    GetResourceStats() {
        return Object.fromEntries(this.#ResourceStats);
    }

    /**
     * 删除指定资源
     * @param {string} InName - 资源名称
     * @returns {boolean} 如果成功删除资源，则返回 true；否则返回 false
     * @private
     */
    DeleteResource(InName) {
        const Info = this.#Resources.get(InName);
        if (Info) {
            const { Resource, Type } = Info;
            if (typeof Resource.destroy === 'function') {
                Resource.destroy();
            }
            this.#Resources.delete(InName);
            this.#UpdateResourceStats(Type, 'Delete');
            return true;
        }
        return false;
    }

    /**
     * 清除所有资源
     * @private
     */
    ClearAll() {
        for (const [Name, Info] of this.#Resources) {
            const { Resource } = Info;
            if (typeof Resource.destroy === 'function') {
                Resource.destroy();
            }
        }
        this.#Resources.clear();
        this.#ResourceStats.clear();
        this.#ResourceVersions.clear();
    }

    /**
     * 更新资源统计信息
     * @param {string} InType - 资源类型
     * @param {string} InAction - 操作类型（Create 或 Delete）
     * @private
     */
    #UpdateResourceStats(InType, InAction) {
        const Stats = this.#ResourceStats.get(InType) || { Count: 0, Created: 0, Deleted: 0 };
        if (InAction === 'Create') {
            Stats.Count++;
            Stats.Created++;
        } else if (InAction === 'Delete') {
            Stats.Count--;
            Stats.Deleted++;
        }
        this.#ResourceStats.set(InType, Stats);
    }

    /**
     * 检查资源是否存在
     * @param {string} InName - 资源名称
     * @returns {boolean} 如果资源存在，则返回 true；否则返回 false
     * @public
     */
    HasResource(InName) {
        return this.#Resources.has(InName);
    }

    GetResourceDescriptor(InName) {
        const Info = this.#Resources.get(InName);
        return Info ? Info.Descriptor : null;
    }

    /**
     * 获取 GPU 设备
     * @returns {Promise<GPUDevice>} GPU设备实例
     */
    async GetDevice() {
        if (!this.#Device) {
            throw new Error('Device not initialized');
        }
        return this.#Device;
    }

    /**
     * 增加指定资源的引用计数，并返回该资源。
     * 如果资源不存在，则返回 null。
     *
     * @param {string} InName - 资源名称
     * @returns {any|null} 返回 GPUResource，如果资源不存在则返回 null
     * @public
     */
    GetResourceRef(InName) {
        const info = this.#Resources.get(InName);
        if (info) {
            info.RefCount++;
            return info.Resource;
        }
        return null;
    }

    /**
     * 释放指定资源的引用计数。
     * 当资源引用计数减少到 0 时，自动删除该资源。
     *
     * @param {string} InName - 资源名称
     * @returns {boolean} 如果成功释放或资源不存在，则返回 true；否则返回 false
     * @public
     */
    ReleaseResourceRef(InName) {
        const info = this.#Resources.get(InName);
        if (info) {
            info.RefCount--;
            if (info.RefCount <= 0) {
                // 当引用计数为 0 时，删除资源
                this.DeleteResource(InName);
            }
            return true;
        }
        return false;
    }
}

export { FResourceManager as default, EResourceType };
