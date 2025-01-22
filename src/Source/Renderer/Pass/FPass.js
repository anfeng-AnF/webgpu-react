import FResourceManager from '../../Core/Resource/FResourceManager.js';

/**
 * Pass资源依赖类型枚举
 */
const EPassDependencyType = {
    Input: 'Input',      // 输入资源
    Output: 'Output',    // 输出资源
    Temporary: 'Temp'    // 临时资源(Pass内部使用)
};

/**
 * 基础Pass类
 * 用于描述渲染通道的资源依赖关系
 */
class FPass {
    #Name;                  // Pass名称
    #Dependencies;          // 资源依赖映射
    #ResourceManager;       // 资源管理器引用
    
    constructor(InName) {
        this.#Name = InName;
        this.#Dependencies = new Map();
        this.#ResourceManager = FResourceManager.GetInstance();
    }

    /**
     * 添加资源依赖
     * @param {string} InResourceName 资源名称
     * @param {EPassDependencyType} InDependencyType 依赖类型
     * @param {Object} InMetadata 额外的元数据信息
     */
    AddDependency(InResourceName, InDependencyType, InMetadata = {}) {
        this.#Dependencies.set(InResourceName, {
            Type: InDependencyType,
            Metadata: InMetadata
        });
    }
    /*
     * 移除资源依赖
     * @param {string} InResourceName 资源名称
     */
    RemoveDependency(InResourceName) {
        this.#Dependencies.delete(InResourceName);
    }
    /**
     * 获取资源实例
     * @param {string} InResourceName 资源名称
     * @returns {GPUResource|null} GPU资源实例
     */
    GetResource(InResourceName) {
        if (!this.#Dependencies.has(InResourceName)) {
            console.warn(`Pass "${this.#Name}" tries to access undeclared resource "${InResourceName}"`);
            return null;
        }
        return this.#ResourceManager.GetResource(InResourceName);
    }

    /**
     * 获取所有依赖资源信息
     * @returns {Map} 依赖资源映射
     */
    GetDependencies() {
        return this.#Dependencies;
    }

    /**
     * 获取特定类型的依赖资源
     * @param {EPassDependencyType} InType 依赖类型
     * @returns {Array} 资源名称列表
     */
    GetDependenciesByType(InType) {
        const Resources = [];
        for (const [Name, Info] of this.#Dependencies) {
            if (Info.Type === InType) {
                Resources.push(Name);
            }
        }
        return Resources;
    }

    /**
     * 验证资源依赖是否都存在
     * @returns {boolean} 是否所有依赖都有效
     */
    ValidateDependencies() {
        for (const [Name] of this.#Dependencies) {
            if (!this.#ResourceManager.HasResource(Name)) {
                console.error(`Missing required resource "${Name}" for pass "${this.#Name}"`);
                return false;
            }
        }
        return true;
    }

    /**
     * 执行Pass
     * 子类需要重写此方法实现具体的渲染逻辑
     * @param {GPUCommandEncoder} InCommandEncoder 命令编码器
     */
    Execute(InCommandEncoder) {
        throw new Error('Execute() must be implemented by subclass');
    }

    /**
     * 获取Pass名称
     */
    GetName() {
        return this.#Name;
    }
}

export { FPass as default, EPassDependencyType }; 