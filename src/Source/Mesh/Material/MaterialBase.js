import FResourceManager, { EResourceType } from '../../Core/Resource/FResourceManager';
import ShaderIncluder from '../../Core/Shader/ShaderIncluder';
import UIDGenerator from '../../utils/UIDGenerator';

/**
 * CustomMaterial 类
 * 用于封装 WebGPU 下自定义材质的实现，提供了创建 shader 模块、管线、Uniform 缓冲区和 BindGroup 的接口，
 * 并能通过传入配置参数扩展管线状态。通过继承该类，你可以方便地实现自己的材质效果。
 */
class FMaterialBase {
    /**
     * 构造函数
     * @param {Object} options - 可选的配置参数，用于初始化材质
     * @param {string} options.vertexShaderPath - 顶点着色器代码路径
     * @param {string} options.fragmentShaderPath - 片元着色器代码路径
     * @param {number} options.uniformBufferSize - Uniform 缓冲区大小
     */
    constructor(options = {}) {
        if(!options.vertexShaderPath || !options.fragmentShaderPath){
            throw new Error('vertexShaderPath and fragmentShaderPath are required');
        }
        this.vertexShaderPath = options.vertexShaderPath;
        this.fragmentShaderPath = options.fragmentShaderPath;

        // Uniform缓冲区大小（以字节计算），例如 64 字节可存储 4x4 矩阵（16 float）
        this.uniformBufferSize = options.uniformBufferSize || 64;

        // 用于存放自定义 uniform 数据（可以扩展更多数据）
        this.customUniformData = new Float32Array(
            this.uniformBufferSize / Float32Array.BYTES_PER_ELEMENT
        );

        // GPU资源Desc，用于判断两个材质是否可重用
        this.pipeLineLayoutDesc = null;
        this.bindGroupLayoutDesc = null;

        this.resourceManager = FResourceManager.GetInstance();
        // 后续创建后会存放 GPU 相关对象名称
        this.pipelineName = UIDGenerator.generate('pipeline_');
        this.bindGroupName = UIDGenerator.generate('bindgroup_');
        this.uniformBufferName = UIDGenerator.generate('uniformbuffer_');
        this.bindGroupLayoutName = UIDGenerator.generate('bindgrouplayout_');
        this.pipelineLayoutName = UIDGenerator.generate('pipelinelayout_');
    }

    /**
     * 初始化材质，创建 Shader 模块
     */
    async init() {
        // 创建 Shader 模块
        const vsCode = await ShaderIncluder.GetCacheStatus(this.vertexShaderPath);
        const fsCode = await ShaderIncluder.GetCacheStatus(this.fragmentShaderPath);

        const vsModuleDesc = {
            Type: EResourceType.ShaderModule,
            desc: { code: vsCode },
        };
        const fsModuleDesc = {
            Type: EResourceType.ShaderModule,
            desc: { code: fsCode },
        };

        // 按照路径创建 Shader 模块 确保同一个Shader不会重复创建
        this.resourceManager.CreateResource(this.vertexShaderPath, vsModuleDesc);
        this.resourceManager.CreateResource(this.fragmentShaderPath, fsModuleDesc);
    }

    /**
     * 更新材质中的 Uniform 数据。你可以在此方法中将应用中的数据上传到 GPU Uniform 缓冲区。
     */
    updateUniforms() {
        //该方法需要子类实现
        throw new Error('updateUniforms method is not implemented');
    }

    /**
     * 返回当前的 BindGroup
     */
    getBindGroup() {
        return this.resourceManager.GetResource(this.bindGroupName);
    }

    /**
     * 返回当前材质使用的 Render Pipeline
     */
    getPipeline() {
        return this.resourceManager.GetResource(this.pipelineName);
    }
}

export default FMaterialBase;
