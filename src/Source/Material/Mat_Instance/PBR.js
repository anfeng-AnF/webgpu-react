/**
 * PBR 材质，用于 StaticMesh
 *
 * 该材质描述采用 StaticMesh 顶点布局（StaticMesh.VertexBufferDesc），
 * 并基于 PBR shader 实现物理渲染。
 *
 * @module PBR
 */

import StaticMesh from '../../Mesh/StaticMesh.js';
import MaterialSystem from '../MaterialSystem.js';
import { BaseMaterial } from '../BaseMaterial.js';
import { MaterialDomain, BlendMode, ShaderModel } from '../MaterialSystem.js';

/**
 * 工厂函数：返回新的 PBR 材质描述对象，用于避免全局唯一导致数据共享问题。
 * @returns {Object} 新的 PBR 材质描述对象
 * @returns {Object.shaderPath} 指定 PBR shader 文件路径，通过 ShaderIncluder 加载并解析 WGSL 代码
 * @returns {Object.pipelineDescriptor} 渲染流水线描述符，注意 vertex.buffers 使用 StaticMesh 的顶点布局
 * @returns {Object.BaseMaterial} 基础材质
 * @returns {Object.BaseColor} 基础颜色
 * @returns {Object.Normal} 法线
 * @returns {Object.Metallic} 金属度
 * @returns {Object.Roughness} 粗糙度
 * @returns {Object.Specular} 镜面反射
 * @returns {Object.PixelDepthOffset} 像素深度偏移
 * @returns {Object.bBaseColorUseTexture} 基础颜色纹理是否使用
 * @returns {Object.bNormalUseTexture} 法线纹理是否使用
 * @returns {Object.bMetallicUseTexture} 金属度纹理是否使用
 * @returns {Object.bRoughnessUseTexture} 粗糙度纹理是否使用
 * @returns {Object.bSpecularUseTexture} 镜面反射纹理是否使用
 * @returns {Object.getMaterialInfo} 获取材质信息
 */
export function createPBRMaterialDesc() {
    return {
        // 指定 PBR shader 文件路径，通过 ShaderIncluder 加载并解析 WGSL 代码
        shaderPath: '/Shader/BasePass/BasePassPBR.wgsl',
        // 渲染流水线描述符，注意 vertex.buffers 使用 StaticMesh 的顶点布局
        pipelineDescriptor: {
            vertex: {
                // module 在 GPUMaterial 内部创建后绑定
                module: null,
                entryPoint: 'VSMain',
                buffers: [
                    StaticMesh.VertexBufferDesc
                ]
            },
            fragment: {
                module: null,
                entryPoint: 'PSMain',
                targets: [
                    {
                        format: 'bgra8unorm'
                    }
                ]
            },
            primitive: {
                topology: 'triangle-list',
                cullMode: 'back'
            },
            layout: 'auto'
        },
        // 下面提供 BindGroup 配置，用于绑定 BaseColor 材质纹理和采样器
        bindGroupLayoutDescriptor: [],
        bindGroupEntries: [],

        /**
         * 基础材质
         * @type {BaseMaterial}
         */
        BaseMaterial: new BaseMaterial(MaterialDomain.Surface, BlendMode.Opaque, ShaderModel.DefaultLit, 'back'),

        // 以下 PBR 参数不会影响 GPU 资源的创建，但可用于后续材质设置和渲染效果调整
        BaseColor: [1.0, 1.0, 1.0, 1.0],
        Normal: [0.0, 0.0, 1.0, 1.0],
        Metallic: 0.0,
        Roughness: 0.0,
        Specular: 0.0,
        PixelDepthOffset: 0.0,
        bBaseColorUseTexture: false, // RGBA
        bNormalUseTexture: false, // RGB
        bMetallicUseTexture: false, // R
        bRoughnessUseTexture: false, // G
        bSpecularUseTexture: false, // B
        /**
         * 获取材质信息
         * 采用 128 字节（32 个 float）的缓冲区，数据布局如下：
         * 索引 0～3   : BaseMaterial 信息（4 float）
         * 索引 4～7   : BaseColor（4 float）
         * 索引 8～10  : Normal（取前三个分量）
         * 索引 11    : Metallic
         * 索引 12    : Roughness
         * 索引 13    : Specular
         * 索引 14    : PixelDepthOffset
         * 索引 15    : materialInfoFlag（各 boolean 标志打包为整数）
         * 剩余填零
         * @returns {Float32Array} 材质信息（长度 32）
         */
        getMaterialInfo() {
            const totalFloats = 16; // 32 floats * 4 = 128 bytes
            const materialInfo = new Float32Array(totalFloats);
            // 获取基础材质信息（4 floats）
            const baseMaterialInfo = this.BaseMaterial.getMaterialInfo(); // length === 4
            materialInfo.set(baseMaterialInfo, 0); // 放在索引 0～3

            // 将 BaseColor 放在索引 4～7
            materialInfo.set(this.BaseColor, 4);

            // 将 Normal 的前三个分量放在索引 8～10
            materialInfo.set(this.Normal.slice(0, 3), 8);

            // Metallic 放在索引 11
            materialInfo[11] = this.Metallic;

            // Roughness 放在索引 12
            materialInfo[12] = this.Roughness;

            // Specular 放在索引 13
            materialInfo[13] = this.Specular;

            // PixelDepthOffset 放在索引 14
            materialInfo[14] = this.PixelDepthOffset;

            // 收集标志位：按位存储各纹理是否使用的标志
            let materialInfoFlag = 0;
            if (this.bBaseColorUseTexture) { materialInfoFlag |= (1 << 0); }
            if (this.bNormalUseTexture)    { materialInfoFlag |= (1 << 1); }
            if (this.bMetallicUseTexture)  { materialInfoFlag |= (1 << 2); }
            if (this.bRoughnessUseTexture) { materialInfoFlag |= (1 << 3); }
            if (this.bSpecularUseTexture)  { materialInfoFlag |= (1 << 4); }
            materialInfo[15] = materialInfoFlag;

            // 剩余部分（索引 16～31）保持为 0（自动填充）
            return materialInfo;
        }
    };
}

/**
 * 创建用于 StaticMesh 的 PBR 材质
 *
 * 根据传入的纹理参数动态生成绑定组描述：
 * 如果某个纹理参数不存在，则使用占位纹理，并将对应的 bXXUseTexture 标识置为 false；
 * 否则，置为 true，并在 BindGroup 中绑定该纹理。
 *
 * 绑定顺序（按绑定 index）:
 *   0 - BaseColor
 *   1 - Normal
 *   2 - Metallic
 *   3 - Roughness
 *   4 - Specular
 *
 * @param {FResourceManager} resourceManager - GPU 资源管理器实例，用于创建和释放资源
 * @param {GPUTexture} BaseColorTexture - 基础颜色纹理 Binding(0)
 * @param {GPUTexture} NormalTexture - 法线纹理 Binding(1)
 * @param {GPUTexture} MetallicTexture - 金属度纹理 Binding(2)
 * @param {GPUTexture} RoughnessTexture - 粗糙度纹理 Binding(3)
 * @param {GPUTexture} SpecularTexture - 镜面反射纹理 Binding(4)
 * 
 * @param {GPUSampler} BaseColorSampler - 基础颜色纹理采样器 Binding(5)
 * @param {GPUSampler} NormalSampler - 法线纹理采样器 Binding(6)
 * @param {GPUSampler} MetallicSampler - 金属度纹理采样器 Binding(7)
 * @param {GPUSampler} RoughnessSampler - 粗糙度纹理采样器 Binding(8)
 * @param {GPUSampler} SpecularSampler - 镜面反射纹理采样器 Binding(9)
 * @returns {Promise<GPUMaterial>} 返回创建的 PBR 材质实例
 */
export async function createPBRMaterial(resourceManager, 
    BaseColorTexture, 
    NormalTexture, 
    MetallicTexture, 
    RoughnessTexture, 
    SpecularTexture,
    BaseColorSampler,
    NormalSampler,
    MetallicSampler,
    RoughnessSampler,
    SpecularSampler
) {
    const PBRMaterialDesc = createPBRMaterialDesc();
    // 对于每个传入的纹理，如果不存在则直接赋值为占位纹理，
    // 并统一标识为使用（bXXUseTexture 均为 true）
    BaseColorTexture = BaseColorTexture || resourceManager.GetResource('placeholder_Texture');
    PBRMaterialDesc.bBaseColorUseTexture = true;

    NormalTexture = NormalTexture || resourceManager.GetResource('placeholder_Texture');
    PBRMaterialDesc.bNormalUseTexture = true;

    MetallicTexture = MetallicTexture || resourceManager.GetResource('placeholder_Texture');
    PBRMaterialDesc.bMetallicUseTexture = true;

    RoughnessTexture = RoughnessTexture || resourceManager.GetResource('placeholder_Texture');
    PBRMaterialDesc.bRoughnessUseTexture = true;

    SpecularTexture = SpecularTexture || resourceManager.GetResource('placeholder_Texture');
    PBRMaterialDesc.bSpecularUseTexture = true;

    // 动态构造 BindGroup 描述
    const bindGroupLayoutDescriptor = [];
    const bindGroupEntries = [];

    // 先添加所有纹理的绑定（binding 0-4）
    bindGroupLayoutDescriptor.push({
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {}
    });
    bindGroupEntries.push({
        binding: 0,
        resource: BaseColorTexture.createView()
    });

    bindGroupLayoutDescriptor.push({
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {}
    });
    bindGroupEntries.push({
        binding: 1,
        resource: NormalTexture.createView()
    });

    bindGroupLayoutDescriptor.push({
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {}
    });
    bindGroupEntries.push({
        binding: 2,
        resource: MetallicTexture.createView()
    });

    bindGroupLayoutDescriptor.push({
        binding: 3,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {}
    });
    bindGroupEntries.push({
        binding: 3,
        resource: RoughnessTexture.createView()
    });

    bindGroupLayoutDescriptor.push({
        binding: 4,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {}
    });
    bindGroupEntries.push({
        binding: 4,
        resource: SpecularTexture.createView()
    });

    // 添加所有采样器的绑定（binding 5-9）
    bindGroupLayoutDescriptor.push({
        binding: 5,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {}
    });
    bindGroupEntries.push({
        binding: 5,
        resource: BaseColorSampler || resourceManager.GetResource('placeholder_Sampler')
    });

    bindGroupLayoutDescriptor.push({
        binding: 6,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {}
    });
    bindGroupEntries.push({
        binding: 6,
        resource: NormalSampler || resourceManager.GetResource('placeholder_Sampler')
    });

    bindGroupLayoutDescriptor.push({
        binding: 7,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {}
    });
    bindGroupEntries.push({
        binding: 7,
        resource: MetallicSampler || resourceManager.GetResource('placeholder_Sampler')
    });

    bindGroupLayoutDescriptor.push({
        binding: 8,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {}
    });
    bindGroupEntries.push({
        binding: 8,
        resource: RoughnessSampler || resourceManager.GetResource('placeholder_Sampler')
    });

    bindGroupLayoutDescriptor.push({
        binding: 9,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {}
    });
    bindGroupEntries.push({
        binding: 9,
        resource: SpecularSampler || resourceManager.GetResource('placeholder_Sampler')
    });

    // 将动态生成的绑定组描述赋值到材质描述中
    PBRMaterialDesc.bindGroupLayoutDescriptor = bindGroupLayoutDescriptor;
    PBRMaterialDesc.bindGroupEntries = bindGroupEntries;

    return await MaterialSystem.createMaterial(PBRMaterialDesc, resourceManager);
}
