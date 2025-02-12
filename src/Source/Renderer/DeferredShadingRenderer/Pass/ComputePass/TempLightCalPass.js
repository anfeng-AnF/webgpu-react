import FPass from '../Pass';
import FResourceManager from '../../../../Core/Resource/FResourceManager';
import { resourceName } from '../../ResourceNames';
import ShaderIncluder from '../../../../Core/Shader/ShaderIncluder';

/**
 * TempLightCalPass
 * 
 * 临时光照计算Pass，使用ShadowMap和GBuffer计算最终光照
 * 输入:
 * - GBufferA (世界空间法线)
 * - GBufferB (Specular,Roughness,Metallic)
 * - GBufferC (BaseColor)
 * - DirectLightShadowMap (阴影贴图)
 * 
 * 输出:
 * - 一个与Canvas大小相同的光照结果纹理
 */
class TempLightCalPass extends FPass {
    constructor() {
        super();
        this._Name = 'TempLightCalPass';
        
        /**
         * 光照结果纹理
         * @type {string}
         */
        this.lightResultTexture = resourceName.LightPass.lightResultTexture;
    }

    /**
     * 初始化资源名称
     */
    async InitResourceName() {
        this._Resources = {
            PassName: this._Name,
            Resources: {
                Dependence: {
                    Texture: [
                        resourceName.BasePass.gBufferA,  // 世界空间法线
                        resourceName.BasePass.gBufferB,  // Specular,Roughness,Metallic
                        resourceName.BasePass.gBufferC,  // BaseColor
                        resourceName.Light.DirectLightShadowMap, // 阴影贴图
                    ],
                },
                Managed: {
                    Texture: [this.lightResultTexture],
                    Pipeline: [resourceName.LightPass.computePipeline],
                },
                Output: {
                    Texture: [this.lightResultTexture],
                },
            },
        };
    }

    /**
     * 初始化渲染通道
     */
    async Initialize(renderer) {
        // 创建光照结果纹理
        await this.OnRenderTargetResize(1920, 1080);

        // 加载计算着色器
        const computeShaderCode = await ShaderIncluder.GetShaderCode('/Shader/LightPass/LightCalCompute.wgsl');
        const computeShader = await this._ResourceManager.CreateResource(
            resourceName.LightPass.computeShader,
            {
                Type: 'ShaderModule',
                desc: {
                    code: computeShaderCode,
                },
            }
        );

        // 创建绑定组布局
        const bindGroupLayout = await this._ResourceManager.CreateResource(
            resourceName.LightPass.computeBindGroupLayout,
            {
                Type: 'BindGroupLayout',
                desc: {
                    entries: [
                        // GBufferA
                        {
                            binding: 0,
                            visibility: GPUShaderStage.COMPUTE,
                            texture: { sampleType: 'float' }
                        },
                        // GBufferB
                        {
                            binding: 1,
                            visibility: GPUShaderStage.COMPUTE,
                            texture: { sampleType: 'float' }
                        },
                        // GBufferC
                        {
                            binding: 2,
                            visibility: GPUShaderStage.COMPUTE,
                            texture: { sampleType: 'float' }
                        },
                        // ShadowMap
                        {
                            binding: 3,
                            visibility: GPUShaderStage.COMPUTE,
                            texture: { sampleType: 'depth' }
                        },
                        // 输出纹理
                        {
                            binding: 4,
                            visibility: GPUShaderStage.COMPUTE,
                            storageTexture: {
                                access: 'write-only',
                                format: 'rgba8unorm'
                            }
                        },
                        // Scene光照信息
                        {
                            binding: 5,
                            visibility: GPUShaderStage.COMPUTE,
                            buffer: { type: 'uniform' }
                        }
                    ],
                },
            }
        );

        // 创建计算管线
        await this._ResourceManager.CreateResource(
            resourceName.LightPass.computePipeline,
            {
                Type: 'ComputePipeline',
                desc: {
                    layout: device.createPipelineLayout({
                        bindGroupLayouts: [bindGroupLayout],
                    }),
                    compute: {
                        module: computeShader,
                        entryPoint: 'main',
                    },
                },
            }
        );

        this._bInitialized = true;
    }

    /**
     * 处理渲染目标大小改变
     */
    async OnRenderTargetResize(Width, Height) {
        await this._ResourceManager.CreateResource(
            this.lightResultTexture,
            {
                Type: 'Texture',
                desc: {
                    size: [Width, Height, 1],
                    format: 'rgba8unorm',
                    usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
                },
            }
        );
    }

    /**
     * 渲染
     */
    async Render(DeltaTime, Scene, CommandEncoder, renderer) {
        const computePass = CommandEncoder.beginComputePass();
        
        // 设置计算管线
        computePass.setPipeline(
            this._ResourceManager.GetResource(resourceName.LightPass.computePipeline)
        );

        // 创建绑定组
        const bindGroup = this._ResourceManager.CreateResource(
            resourceName.LightPass.computeBindGroup,
            {
                Type: 'BindGroup',
                desc: {
                    layout: this._ResourceManager.GetResource(resourceName.LightPass.computeBindGroupLayout),
                    entries: [
                        {
                            binding: 0,
                            resource: this._ResourceManager.GetResource(resourceName.BasePass.gBufferA).createView()
                        },
                        {
                            binding: 1,
                            resource: this._ResourceManager.GetResource(resourceName.BasePass.gBufferB).createView()
                        },
                        {
                            binding: 2,
                            resource: this._ResourceManager.GetResource(resourceName.BasePass.gBufferC).createView()
                        },
                        {
                            binding: 3,
                            resource: this._ResourceManager.GetResource(resourceName.Light.DirectLightShadowMap).createView()
                        },
                        {
                            binding: 4,
                            resource: this._ResourceManager.GetResource(this.lightResultTexture).createView()
                        },
                        {
                            binding: 5,
                            resource: { buffer: Scene.sceneLightBindGroup }
                        }
                    ],
                },
            }
        );

        computePass.setBindGroup(0, bindGroup);

        // 调度计算着色器
        const width = renderer.Width;
        const height = renderer.Height;
        computePass.dispatchWorkgroups(
            Math.ceil(width / 8),
            Math.ceil(height / 8),
            1
        );

        computePass.end();
    }

    /**
     * 销毁资源
     */
    async Destroy() {
        this._ResourceManager.DeleteResource(this.lightResultTexture);
        this._ResourceManager.DeleteResource(resourceName.LightPass.computePipeline);
        this._ResourceManager.DeleteResource(resourceName.LightPass.computeShader);
        this._ResourceManager.DeleteResource(resourceName.LightPass.computeBindGroupLayout);
    }
}

export default TempLightCalPass;

