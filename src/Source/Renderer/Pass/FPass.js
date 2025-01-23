import FResourceManager from '../../Core/Resource/FResourceManager.js';

/**
 * Pass 资源类型枚举
 */
export const EPassResourceType = {
    Input: 'Input',       // 输入资源
    Output: 'Output',     // 输出资源
    Fixed: 'Fixed'        // 固定资源(Pipeline、BindGroup等)
};

/**
 * 基础Pass类
 * 用于描述渲染通道的资源依赖关系
 */
class FPass {
    #Name;                   // Pass名称
    #InputResources = [];     // 输入资源数组
    #OutputResources = [];    // 输出资源数组
    #FixedResources = [];     // 固定资源数组(Pipeline、BindGroup等)
    #ResourceManager;

    constructor(InName) {
        this.#Name = InName;
        this.#ResourceManager = FResourceManager.GetInstance();
    }

    /**
     * 添加输入资源
     * @param {string} InName 资源名称
     * @param {Object} InDesc 资源描述
     */
    AddInputResource(InName, InDesc = {}) {
        this.#InputResources.push({
            Name: InName,
            Description: InDesc.Description || '',
            Resource: null
        });
    }

    /**
     * 添加输出资源
     * @param {string} InName 资源名称
     * @param {Object} InDesc 资源描述
     */
    AddOutputResource(InName, InDesc = {}) {
        this.#OutputResources.push({
            Name: InName,
            Description: InDesc.Description || '',
            Resource: null
        });
    }

    /**
     * 添加固定资源
     * @param {string} InName 资源名称
     * @param {Object} InDesc 资源描述
     */
    AddFixedResource(InName, InDesc = {}) {
        this.#FixedResources.push({
            Name: InName,
            Description: InDesc.Description || '',
            Resource: null
        });
    }

    /**
     * 设置资源
     * @param {string} InName 资源名称
     * @param {GPUResource} InResource GPU资源
     * @param {EPassResourceType} InType 资源类型
     */
    SetResource(InName, InResource, InType) {
        let resourceArray;
        switch (InType) {
            case EPassResourceType.Input:
                resourceArray = this.#InputResources;
                break;
            case EPassResourceType.Output:
                resourceArray = this.#OutputResources;
                break;
            case EPassResourceType.Fixed:
                resourceArray = this.#FixedResources;
                break;
            default:
                console.error(`Unknown resource type: ${InType}`);
                return;
        }

        const resource = resourceArray.find(r => r.Name === InName);
        if (resource) {
            resource.Resource = InResource;
        } else {
            console.warn(`Resource "${InName}" not found in ${this.#Name}`);
        }
    }

    /**
     * 获取资源
     * @param {string} InName 资源名称
     * @returns {GPUResource|null} GPU资源
     */
    GetResource(InName) {
        const resource = 
            this.#InputResources.find(r => r.Name === InName) ||
            this.#OutputResources.find(r => r.Name === InName) ||
            this.#FixedResources.find(r => r.Name === InName);
        
        return resource ? resource.Resource : null;
    }

    /**
     * 验证所有资源是否就绪
     * @returns {boolean} 是否所有资源都已就绪
     */
    ValidateResources() {
        const validateArray = (array) => {
            return array.every(r => {
                if (!r.Resource) {
                    console.warn(`Resource "${r.Name}" not set in ${this.#Name}`);
                    return false;
                }
                return true;
            });
        };

        return validateArray(this.#InputResources) && 
               validateArray(this.#OutputResources) &&
               validateArray(this.#FixedResources);
    }

    /**
     * 执行渲染通道
     * @abstract
     */
    Execute() {
        throw new Error('Execute() must be implemented by subclass');
    }

    /**
     * 获取Pass名称
     */
    GetName() {
        return this.#Name;
    }
}

export default FPass; 