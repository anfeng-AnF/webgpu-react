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
        });

        this.#UpdateResourceStats(InDesc.Type, 'Create');

        return Resource;
    }

    GetResourceInfo(InName) {
        return this.#Resources.get(InName);
    }

    /**
     *
     * @param InName
     * @returns {GPUBuffer|GPUTexture|GPUBindGroup|null}
     * @constructor
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
}

export { FResourceManager as default, EResourceType };
