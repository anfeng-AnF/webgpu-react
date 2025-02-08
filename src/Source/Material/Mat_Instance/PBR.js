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
import GPUScene from '../../Scene/GPUScene.js';
import FResourceManager from '../../Core/Resource/FResourceManager.js';
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
                buffers: [StaticMesh.VertexBufferDesc],
            },
            fragment: {
                module: null,
                entryPoint: 'PSMain',
                targets: [
                    {
                        format: 'bgra8unorm',
                    },
                ],
            },
            primitive: {
                topology: 'triangle-list',
                cullMode: 'back',
            },
            layout: 'auto',
        },
        // 下面提供 BindGroup 配置，用于绑定 BaseColor 材质纹理和采样器
        bindGroupLayoutDescriptor: [],
        bindGroupEntries: [],

        /**
         * 基础材质
         * @type {BaseMaterial}
         */
        BaseMaterial: new BaseMaterial(
            MaterialDomain.Surface,
            BlendMode.Opaque,
            ShaderModel.DefaultLit,
            'back'
        ),
        // 用于材质实例的动态属性
        dynamicAttributes: {
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
             * 获取动态属性信息
             * 采用 12 x f32（36 字节）的缓冲区，数据布局如下：
             * 索引 0～3   : BaseColor（4 float）
             * 索引 4～6   : Normal（取前三个分量）
             * 索引 7     : Metallic
             * 索引 8     : Roughness
             * 索引 9     : Specular
             * 索引 10    : PixelDepthOffset
             * 索引 11    : materialInfoFlag（各 boolean 标志打包为整数）
             * @returns {Float32Array} 动态属性信息
             */
            getDynamicAttributes() {
                const materialInfo = new Float32Array(12);
                // 将 BaseColor 放在索引 0～3
                materialInfo.set(this.BaseColor, 0);

                // 将 Normal 的前三个分量放在索引 4～6
                materialInfo.set(this.Normal.slice(0, 3), 4);

                // Metallic 放在索引 7
                materialInfo[7] = this.Metallic;

                // Roughness 放在索引 8
                materialInfo[8] = this.Roughness;

                // Specular 放在索引 9
                materialInfo[9] = this.Specular;

                // PixelDepthOffset 放在索引 10
                materialInfo[10] = this.PixelDepthOffset;

                // 收集标志位：按位存储各纹理是否使用的标志
                let materialInfoFlag = 0;
                if (this.bBaseColorUseTexture) {
                    materialInfoFlag |= 1 << 0;
                }
                if (this.bNormalUseTexture) {
                    materialInfoFlag |= 1 << 1;
                }
                if (this.bMetallicUseTexture) {
                    materialInfoFlag |= 1 << 2;
                }
                if (this.bRoughnessUseTexture) {
                    materialInfoFlag |= 1 << 3;
                }
                if (this.bSpecularUseTexture) {
                    materialInfoFlag |= 1 << 4;
                }
                materialInfo[11] = materialInfoFlag;

                return materialInfo;
            },
        },
        /**
         * 获取材质信息
         * 采用 16 x f32（64 字节）的缓冲区，数据布局如下：
         * 索引 0～3   : BaseMaterial 信息（4 float）
         * 索引 4～7   : BaseColor（4 float）
         * 索引 8～11  : Normal（取前三个分量）
         * 索引 12    : Metallic
         * 索引 13    : Roughness
         * 索引 14    : Specular
         * 索引 15    : PixelDepthOffset
         * 索引 16    : materialInfoFlag（各 boolean 标志打包为整数）
         * 剩余填零
         * @returns {Float32Array} 材质信息（长度 64）
         */
        getMaterialInfo() {
            const totalFloats = 16; // 32 floats * 4 = 128 bytes
            const materialInfo = new Float32Array(totalFloats);
            // 获取基础材质信息（4 floats）
            const baseMaterialInfo = this.BaseMaterial.getMaterialInfo(); // length === 4
            materialInfo.set(baseMaterialInfo, 0); // 放在索引 0～3

            // 获取动态属性信息（12 floats）
            const dynamicAttributesInfo = this.dynamicAttributes.getDynamicAttributes(); // length === 12
            materialInfo.set(dynamicAttributesInfo, 4); // 放在索引 4～15

            return materialInfo;
        },

        /**
         * 判断两个材质GPU资源是否相同
         * @param {Object} materialDesc - 材质描述对象
         * @returns {boolean} 是否相同
         */
        isSameMaterial(materialDesc) {
            // 检查是否为相同类型的材质
            if (!materialDesc || typeof materialDesc !== 'object') {
                return false;
            }

            // 比较影响 GPU 资源创建的关键字段
            if (this.shaderPath !== materialDesc.shaderPath) {
                return false;
            }

            // 比较 pipelineDescriptor 中的关键属性
            const thisDesc = this.pipelineDescriptor;
            const otherDesc = materialDesc.pipelineDescriptor;

            if (!otherDesc) return false;

            // 比较顶点着色器配置
            if (thisDesc.vertex.entryPoint !== otherDesc.vertex.entryPoint) {
                return false;
            }

            // 比较片段着色器配置
            if (
                thisDesc.fragment.entryPoint !== otherDesc.fragment.entryPoint ||
                thisDesc.fragment.targets[0].format !== otherDesc.fragment.targets[0].format
            ) {
                return false;
            }

            // 比较图元和光栅化状态
            if (
                thisDesc.primitive.topology !== otherDesc.primitive.topology ||
                thisDesc.primitive.cullMode !== otherDesc.primitive.cullMode
            ) {
                return false;
            }

            // 比较 pipelineLayout
            if (
                !this.pipelineLayout ||
                !materialDesc.pipelineLayout ||
                this.pipelineLayout.length !== materialDesc.pipelineLayout.length
            ) {
                return false;
            }

            // 比较每个 pipelineLayout 元素
            for (let i = 0; i < this.pipelineLayout.length; i++) {
                if (this.pipelineLayout[i] !== materialDesc.pipelineLayout[i]) {
                    return false;
                }
            }

            // 比较 bindGroupLayoutDescriptor 的长度和内容
            if (
                this.bindGroupLayoutDescriptor.length !==
                materialDesc.bindGroupLayoutDescriptor.length
            ) {
                return false;
            }

            // 比较每个 binding 的配置
            for (let i = 0; i < this.bindGroupLayoutDescriptor.length; i++) {
                const thisBinding = this.bindGroupLayoutDescriptor[i];
                const otherBinding = materialDesc.bindGroupLayoutDescriptor[i];

                if (
                    thisBinding.binding !== otherBinding.binding ||
                    thisBinding.visibility !== otherBinding.visibility
                ) {
                    return false;
                }
            }

            return true;
        },
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
export async function createPBRMaterial(
    resourceManager,
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
    PBRMaterialDesc.dynamicAttributes.bBaseColorUseTexture = BaseColorTexture !== null;
    BaseColorTexture = BaseColorTexture || resourceManager.GetResource('placeholder_Texture');

    PBRMaterialDesc.dynamicAttributes.bNormalUseTexture = NormalTexture !== null;
    NormalTexture = NormalTexture || resourceManager.GetResource('placeholder_Texture');

    PBRMaterialDesc.dynamicAttributes.bMetallicUseTexture = MetallicTexture !== null;
    MetallicTexture = MetallicTexture || resourceManager.GetResource('placeholder_Texture');

    PBRMaterialDesc.dynamicAttributes.bRoughnessUseTexture = RoughnessTexture !== null;
    RoughnessTexture = RoughnessTexture || resourceManager.GetResource('placeholder_Texture');

    PBRMaterialDesc.dynamicAttributes.bSpecularUseTexture = SpecularTexture !== null;
    SpecularTexture = SpecularTexture || resourceManager.GetResource('placeholder_Texture');

    // 动态构造 BindGroup 描述
    const entries = [
        // 纹理绑定（binding 0-4）
        {
            binding: 0,
            visibility: GPUShaderStage.FRAGMENT,
            texture: {
                sampleType: 'float',
                viewDimension: '2d',
            },
        },
        {
            binding: 1,
            visibility: GPUShaderStage.FRAGMENT,
            texture: {
                sampleType: 'float',
                viewDimension: '2d',
            },
        },
        {
            binding: 2,
            visibility: GPUShaderStage.FRAGMENT,
            texture: {
                sampleType: 'float',
                viewDimension: '2d',
            },
        },
        {
            binding: 3,
            visibility: GPUShaderStage.FRAGMENT,
            texture: {
                sampleType: 'float',
                viewDimension: '2d',
            },
        },
        {
            binding: 4,
            visibility: GPUShaderStage.FRAGMENT,
            texture: {
                sampleType: 'float',
                viewDimension: '2d',
            },
        },
        // 采样器绑定（binding 5-9）
        {
            binding: 5,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: {
                type: 'filtering',
            },
        },
        {
            binding: 6,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: {
                type: 'filtering',
            },
        },
        {
            binding: 7,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: {
                type: 'filtering',
            },
        },
        {
            binding: 8,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: {
                type: 'filtering',
            },
        },
        {
            binding: 9,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: {
                type: 'filtering',
            },
        },
    ];

    const bindGroupEntries = [
        {
            binding: 0,
            resource:
                BaseColorTexture?.createView() ||
                resourceManager.GetResource('placeholder_Texture').createView(),
        },
        {
            binding: 1,
            resource:
                NormalTexture?.createView() ||
                resourceManager.GetResource('placeholder_Texture').createView(),
        },
        {
            binding: 2,
            resource:
                MetallicTexture?.createView() ||
                resourceManager.GetResource('placeholder_Texture').createView(),
        },
        {
            binding: 3,
            resource:
                RoughnessTexture?.createView() ||
                resourceManager.GetResource('placeholder_Texture').createView(),
        },
        {
            binding: 4,
            resource:
                SpecularTexture?.createView() ||
                resourceManager.GetResource('placeholder_Texture').createView(),
        },
        {
            binding: 5,
            resource: BaseColorSampler || resourceManager.GetResource('placeholder_Sampler'),
        },
        {
            binding: 6,
            resource: NormalSampler || resourceManager.GetResource('placeholder_Sampler'),
        },
        {
            binding: 7,
            resource: MetallicSampler || resourceManager.GetResource('placeholder_Sampler'),
        },
        {
            binding: 8,
            resource: RoughnessSampler || resourceManager.GetResource('placeholder_Sampler'),
        },
        {
            binding: 9,
            resource: SpecularSampler || resourceManager.GetResource('placeholder_Sampler'),
        },
    ];

    // 将动态生成的绑定组描述赋值到材质描述中
    PBRMaterialDesc.bindGroupLayoutDescriptor = entries;
    PBRMaterialDesc.bindGroupEntries = bindGroupEntries;

    // 创建材质
    const material = await MaterialSystem.createMaterial(PBRMaterialDesc, resourceManager);

    // 创建BindGroup
    await material.createBindGroup();

    return material;
}
