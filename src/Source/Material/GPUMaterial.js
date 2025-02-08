/**
 * GPUMaterial
 * 管理材质相关的 GPU 资源，包括渲染流水线、着色器模块和绑定组布局。
 *
 * @param {Object} materialDesc - 材质描述对象，必须包含以下属性：
 *    - shaderCode {string}: 着色器代码字符串 或者 shaderPath, 指定 shader 文件路径
 *    - pipelineDescriptor {Object}: 用于创建渲染流水线的描述符
 * @param {FResourceManager} resourceManager - GPU 资源管理器实例，用于创建和释放资源
 */
export default class GPUMaterial {
    constructor(materialDesc, resourceManager) {
        this.materialDesc = materialDesc;
        this.resourceManager = resourceManager;
        this.renderPipeline = null;
        this.shaderModule = null;
        this.bindGroupLayout = null;
        this.bindGroup = null;
        this.materialId = `material_${GPUMaterial.counter++}`;
        /**
         * 实例材质
         * @type {Array<MaterialDesc.dynamicAttributes>}
         */
        this.InstanceMaterial = [];
    }

    // 静态计数器
    static counter = 0;

    /**
     * 创建着色器模块
     * @throws 如果 materialDesc 没有提供 shaderCode 则报错
     */
    async createShaderModule() {
        let shaderCode;
        // 如果提供了 shaderPath，则通过 ShaderIncluder 解析shader文件
        if (this.materialDesc.shaderPath) {
            // 使用动态import引入 ShaderIncluder（确保路径正确，根据项目结构可适当调整）
            const { default: ShaderIncluder } = await import('../Core/Shader/ShaderIncluder.js');
            shaderCode = await ShaderIncluder.GetShaderCode(this.materialDesc.shaderPath);
        } else if (this.materialDesc.shaderCode) {
            shaderCode = this.materialDesc.shaderCode;
        } else {
            throw new Error('MaterialDescription must include either shaderPath or shaderCode property.');
        }

        // 通过 ResourceManager 创建着色器模块
        this.shaderModule = this.resourceManager.CreateResource(`${this.materialId}_ShaderModule`, {
            Type: 'ShaderModule',
            desc: {
                code: shaderCode
            }
        });
    }

    /**
     * 创建渲染流水线
     * 如果着色器模块尚未创建，则先创建它。
     * @throws 如果 materialDesc 没有提供 pipelineDescriptor 则报错
     */
    async createRenderPipeline() {
        if (!this.shaderModule) {
            await this.createShaderModule();
        }
        if (!this.materialDesc.pipelineDescriptor) {
            throw new Error('MaterialDescription must include pipelineDescriptor property.');
        }
        // 确保 shaderModule 已创建，并赋值给流水线描述符的 vertex 和 fragment 阶段
        if (!this.materialDesc.pipelineDescriptor.vertex.module) {
            this.materialDesc.pipelineDescriptor.vertex.module = this.shaderModule;
        }
        if (!this.materialDesc.pipelineDescriptor.fragment.module) {
            this.materialDesc.pipelineDescriptor.fragment.module = this.shaderModule;
        }

        // 通过 ResourceManager 创建渲染流水线
        this.renderPipeline = this.resourceManager.CreateResource(`${this.materialId}_RenderPipeline`, {
            Type: 'RenderPipeline',
            desc: this.materialDesc.pipelineDescriptor
        });
    }

    /**
     * 创建 BindGroup。
     * 若材质描述中提供了有效的 bindGroupLayoutDescriptor 与 bindGroupEntries，
     * 则根据 materialDesc 创建绑定组布局和绑定组。
     * 这样可以灵活定义绑定点、绑定项以及相关的资源（例如用于 BaseColor 的 Texture 和 Sampler）。
     */
    async createBindGroup() {
        if (this.materialDesc.bindGroupLayoutDescriptor && this.materialDesc.bindGroupEntries) {
            // 创建绑定组布局，由材质描述定义
            this.bindGroupLayout = this.resourceManager.CreateResource(`${this.materialId}_BindGroupLayout`, {
                Type: 'BindGroupLayout',
                desc: {
                    entries: this.materialDesc.bindGroupLayoutDescriptor  // bindGroupLayoutDescriptor已经是entries数组
                }
            });

            // 创建绑定组，由材质描述定义
            this.bindGroup = this.resourceManager.CreateResource(`${this.materialId}_BindGroup`, {
                Type: 'BindGroup',
                desc: {
                    layout: this.bindGroupLayout,
                    entries: this.materialDesc.bindGroupEntries
                }
            });
        }
    }

    /**
     * 销毁材质相关的 GPU 资源，包括渲染流水线、着色器模块和绑定组。
     * 通过 ResourceManager 释放所有相关资源引用。
     */
    destroy() {
        if (this.shaderModule) {
            this.resourceManager.DeleteResource(`${this.materialId}_ShaderModule`);
            this.shaderModule = null;
        }
        if (this.renderPipeline) {
            this.resourceManager.DeleteResource(`${this.materialId}_RenderPipeline`);
            this.renderPipeline = null;
        }
        if (this.bindGroup) {
            this.resourceManager.DeleteResource(`${this.materialId}_BindGroup`);
            this.bindGroup = null;
        }
        if (this.bindGroupLayout) {
            this.resourceManager.DeleteResource(`${this.materialId}_BindGroupLayout`);
            this.bindGroupLayout = null;
        }
    }

    /**
     * 获取材质信息
     * @returns {Float32Array} 材质信息
     */
    getMaterialInfo() {
        return this.materialDesc.getMaterialInfo();
    }

    /**
     * 获取基础材质信息
     * @returns {Float32Array} 基础材质信息
     */
    getBaseMaterialInfo() {
        return this.materialDesc.BaseMaterial.getMaterialInfo();
    }
} 

export class GPUMaterialInstance {
    /**
     * 构造函数
     * @param {GPUMaterial} GPUMaterial - 基础材质
     */
    constructor(GPUMaterial) {
        this.GPUMaterial = GPUMaterial;
        // 对 dynamicAttributes 做拆解，排除 getDynamicAttributes 函数
        const { getDynamicAttributes, ...data } = GPUMaterial.materialDesc.dynamicAttributes;
        // 使用 structuredClone 复制纯数据部分
        const clonedData = structuredClone(data);
        // 重新附回函数，并绑定到克隆后的对象上，确保 this 指向正确（指向自身数据）
        clonedData.getDynamicAttributes = getDynamicAttributes.bind(clonedData);
        this.dynamicAttributes = clonedData;
    }

    /**
     * 获取材质信息
     * @returns {Float32Array} 材质信息
     */
    getMaterialInfo() {
        //f32 x 4
        const baseMaterialInfo = this.GPUMaterial.getBaseMaterialInfo();

        const dynamicAttributesInfo = this.dynamicAttributes.getDynamicAttributes();
        const materialInfo = new Float32Array(baseMaterialInfo.length + dynamicAttributesInfo.length);
        materialInfo.set(baseMaterialInfo, 0);
        materialInfo.set(dynamicAttributesInfo, baseMaterialInfo.length);
        return materialInfo;
    }
}