import CustomMaterial from './CustomMaterial.js';
import UIDGenerator from '../../utils/UIDGenerator.js';
import FResourceManager, { EResourceType } from '../../Core/Resource/FResourceManager';

/**
 * FPBRMaterialOptions 类
 * 用于存储 PBR 材质的选项
 */
class FPBRMaterialOptions {
    /**
     * 基础色 一个值或者资源管理器中的Texture名称  float32x4
     * @type {Float32Array|String}
     */
    BaseColor = [1.0, 1.0, 1.0, 1.0];
    bBaseColorUseTexture = false;

    /**
     * 金属度 0-1 一个值或者资源管理器中的Texture名称  float
     * @type {number|String}
     */
    Metallic = 0.0;
    bMetallicUseTexture = false;

    /**
     * 高光度 0-1 一个值或者资源管理器中的Texture名称  float
     * @type {number|String}
     */
    Specular = 0.0;
    bSpecularUseTexture = false;

    /**
     * 粗糙度 0-1 一个值或者资源管理器中的Texture名称  float
     * @type {number|String}
     */
    Roughness = 1.0;
    bRoughnessUseTexture = false;

    /**
     * 像素深度偏移 一个值或者资源管理器中的Texture名称  float
     * @type {number|String}
     */
    PixelDepthOffset = 0.0;
    bPixelDepthOffsetUseTexture = false;
}

/**
 * FPBRMaterial 类
 */
class FPBRMaterial extends CustomMaterial {

    /**
     * PBR 材质选项
     * @type {PBRMaterialOptions}
     */
    PBRMaterialOptions = null;

    constructor(options = {}) {
        super(options);
        // 如果未设置自定义的 PBR 材质选项，则使用默认值
        if (!this.PBRMaterialOptions) {
            this.PBRMaterialOptions = new FPBRMaterialOptions();
        }
    }

    /**
     * 重写 init 方法，初始化 shader 模块、uniform buffer、bind group、pipeline 等 GPU 资源
     * @returns {Promise<void>}
     */
    async init() {
        // 调用父类初始化以创建shader模块
        await super.init();

        // 创建uniform buffer
        const uniformBufferDesc = {
            Type: EResourceType.Buffer,
            desc: {
                size: 8 * 4, // 8个float32值 (baseColor[4] + metallic + specular + roughness + pixelDepthOffset)
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            }
        };
        this.resourceManager.CreateResource(this.uniformBufferName, uniformBufferDesc);

        // 创建bind group layout - 只包含uniform buffer
        this.bindGroupLayoutDesc = {
            Type: EResourceType.BindGroupLayout,
            desc: {
                entries: [
                    {
                        binding: 0,
                        visibility: GPUShaderStage.FRAGMENT,
                        buffer: {
                            type: "uniform"
                        }
                    }
                ]
            }
        };
        this.resourceManager.CreateResource(this.bindGroupLayoutName, this.bindGroupLayoutDesc);

        // 创建pipeline layout
        this.pipeLineLayoutDesc = {
            Type: EResourceType.PipelineLayout,
            desc: {
                bindGroupLayouts: [
                    this.resourceManager.GetResource(this.bindGroupLayoutName)
                ]
            }
        };
        this.resourceManager.CreateResource(this.pipelineLayoutName, this.pipeLineLayoutDesc);

        // 创建bind group - 只绑定uniform buffer
        const bindGroupDesc = {
            Type: EResourceType.BindGroup,
            desc: {
                layout: this.resourceManager.GetResource(this.bindGroupLayoutName),
                entries: [
                    {
                        binding: 0,
                        resource: {
                            buffer: this.resourceManager.GetResource(this.uniformBufferName)
                        }
                    }
                ]
            }
        };
        this.resourceManager.CreateResource(this.bindGroupName, bindGroupDesc);
    }

    /**
     * 更新材质中的 Uniform 数据，将 PBR 材质参数上传到 GPU uniform buffer
     * 布局示例（按 Float32 数组排列）：
     * offset 0-3: BaseColor (vec4)
     * offset 4: Metallic
     * offset 5: Specular
     * offset 6: Roughness
     * offset 7: PixelDepthOffset
     */
    async updateUniforms() {
        const device = await this.resourceManager.GetDevice();
        // 确保 FPBRMaterialOptions 已经存在
        if (!this.PBRMaterialOptions) {
            this.PBRMaterialOptions = new FPBRMaterialOptions();
        }
        
        const uniformData = new Float32Array(8);
        // 设置 BaseColor(确保长度为4)
        const baseColor = this.PBRMaterialOptions.BaseColor;
        uniformData.set(baseColor.slice(0, 4), 0);
        // 设置 Metallic、Specular、Roughness、PixelDepthOffset
        uniformData[4] = this.PBRMaterialOptions.Metallic;
        uniformData[5] = this.PBRMaterialOptions.Specular;
        uniformData[6] = this.PBRMaterialOptions.Roughness;
        uniformData[7] = this.PBRMaterialOptions.PixelDepthOffset;
        
        // 将更新后的 uniform 数据写入 GPU buffer
        const buffer = this.resourceManager.GetResource(this.uniformBufferName);
        device.queue.writeBuffer(
            buffer,
            0,
            uniformData.buffer,
            uniformData.byteOffset,
            uniformData.byteLength
        );
    }

    /**
     * 更新自定义材质数据（如果有需要可以在此进行扩展）
     */
    updateMaterialUniforms() {
        // 可在此处根据需要更新自定义材质相关的 uniform 数据
    }

    /**
     * 设置 PBR 材质选项
     * @param {PBRMaterialOptions} options - PBR 材质选项
     */
    setOptions(options) {
        this.PBRMaterialOptions = options;
    }
}

export default FPBRMaterial;
