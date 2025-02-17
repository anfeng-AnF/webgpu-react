import FPass from '../Pass';
import FResourceManager from '../../../../Core/Resource/FResourceManager';
import ShaderIncluder from '../../../../Core/Shader/ShaderIncluder';
import { resourceName } from '../../ResourceNames';
import FDeferredShadingSceneRenderer from '../../FDeferredShadingSceneRenderer';
import { sampler } from 'three/tsl';
/**
 * TestShadowRender Pass 用于调试阴影贴图效果，
 * 将 ShadowMapPass 生成的阴影贴图通过全屏绘制显示出来。
 */
class TestShadowRender extends FPass {
    // 定义调试渲染结果的输出纹理名称（可在 resourceName 中配置）
    renderTargetName = 'TestShadowRenderRT';

    constructor() {
        super();
        this._Name = 'TestShadowRender';
        this.bCanvasReady = false;
    }

    /**
     * 初始化资源名称
     */
    async InitResourceName() {
        this._Resources = {
            PassName: this._Name,
        };
    }

    /**
     * 初始化 TestShadowRender Pass
     * 1. 创建用于输出调试结果的 render target
     * 2. 加载 shader 并创建 shader module
     * 3. 创建 PipelineLayout 与 RenderPipeline；同时创建绑定组用于采样阴影贴图
     * @param {FDeferredShadingSceneRenderer} renderer 渲染器
     */
    async Initialize(renderer) {
        this.shaderCode = await ShaderIncluder.GetShaderCode('/Shader/LightPass/test.wgsl');

        this.shaderModule = await this._ResourceManager.CreateResource(
            'TestShadowRenderShaderModule',
            {
                Type: 'ShaderModule',
                desc: {
                    code: this.shaderCode,
                },
            }
        );

        // 创建 BindGroupLayout 描述符，根据注释定义：
        // bindings 0-3：GBufferA-D
        // binding 4：SceneDepth
        // binding 5：ShadowMap
        // binding 6：outputtexture（作为 storage texture 用于写入）
        this.testBindGroupLayout = await this._ResourceManager.CreateResource(
            'TestShadowRenderBindGroupLayout',
            {
                Type: 'BindGroupLayout',
                desc: {
                    entries: [
                        {
                            binding: 0,
                            visibility: GPUShaderStage.COMPUTE,
                            texture: { sampleType: 'float', viewDimension: '2d' },
                        },
                        {
                            binding: 1,
                            visibility: GPUShaderStage.COMPUTE,
                            texture: { sampleType: 'float', viewDimension: '2d' },
                        },
                        {
                            binding: 2,
                            visibility: GPUShaderStage.COMPUTE,
                            texture: { sampleType: 'float', viewDimension: '2d' },
                        },
                        {
                            binding: 3,
                            visibility: GPUShaderStage.COMPUTE,
                            texture: { sampleType: 'float', viewDimension: '2d' },
                        },
                        {
                            binding: 4,
                            visibility: GPUShaderStage.COMPUTE,
                            texture: { sampleType: 'depth', viewDimension: '2d' },
                        },
                        {
                            binding: 5,
                            visibility: GPUShaderStage.COMPUTE,
                            texture: { sampleType: 'depth', viewDimension: '2d' },
                        },
                        {
                            binding: 6,
                            visibility: GPUShaderStage.COMPUTE,
                            storageTexture: {
                                access: 'write-only',
                                format: 'rgba8unorm',
                            },
                        },
                        {
                            binding: 7,
                            visibility: GPUShaderStage.COMPUTE,
                            sampler:{}
                        }
                    ],
                },
            }
        );

        // 获取外部传入的 BindGroupLayout（sceneBuffer 和 sceneLight），然后创建计算管线所需的 pipelineLayout：
        // 计算管线Desc：
        //  0 - sceneBuffer
        //  1 - 本 Pass 的 BindGroup
        //  2 - sceneLight
        this.testPipelineLayout = await this._ResourceManager.CreateResource(
            'TestShadowRenderPipelineLayout',
            {
                Type: 'PipelineLayout',
                desc: {
                    bindGroupLayouts: [
                        renderer.Scene.sceneBindGroupLayout,
                        this.testBindGroupLayout,
                        renderer.Scene.sceneLightBindGroupLayout,
                    ],
                },
            }
        );

        // 创建计算管线
        this.testPipeline = await this._ResourceManager.CreateResource('TestShadowRenderPipeline', {
            Type: 'ComputePipeline',
            desc: {
                layout: this.testPipelineLayout,
                compute: {
                    module: this.shaderModule,
                    entryPoint: 'CSMain',
                },
            },
        });

        this._bInitialized = true;

        this.depthSampler = this._ResourceManager.CreateResource(
            'shadowDepthSampler',
            {
                Type: 'Sampler',
                desc: {
                    magFilter: 'linear',
                    minFilter: 'linear',
                }
            });
    }

    /**
     * 处理渲染目标大小改变
     */
    async OnRenderTargetResize(Width, Height) {
        this.width = Number(Width);
        this.height = Number(Height);
        this.renderTarget = this._ResourceManager.CreateResource(this.renderTargetName, {
            Type: 'Texture',
            desc: {
                size: { width: Width, height: Height },
                format: 'rgba8unorm',
                usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
            },
        });

        // 更新 BindGroup
        this.testBindGroup = await this._ResourceManager.CreateResource(
            'TestShadowRenderBindGroup',
            {
                Type: 'BindGroup',
                desc: {
                    layout: this.testBindGroupLayout,
                    entries: [
                        {
                            binding: 0,
                            resource: this._ResourceManager
                                .GetResource(resourceName.BasePass.gBufferA)
                                .createView(),
                        },
                        {
                            binding: 1,
                            resource: this._ResourceManager
                                .GetResource(resourceName.BasePass.gBufferB)
                                .createView(),
                        },
                        {
                            binding: 2,
                            resource: this._ResourceManager
                                .GetResource(resourceName.BasePass.gBufferC)
                                .createView(),
                        },
                        {
                            binding: 3,
                            resource: this._ResourceManager
                                .GetResource(resourceName.BasePass.gBufferD)
                                .createView(),
                        },
                        {
                            binding: 4,
                            resource: this._ResourceManager
                                .GetResource(resourceName.PrePass.depthTexture)
                                .createView(),
                        },
                        {
                            binding: 5,
                            resource: this._ResourceManager
                                .GetResource('DirectLightShadowMap')
                                .createView(),
                        },
                        {
                            binding: 6,
                            resource: this.renderTarget.createView(),
                        },
                        {
                            binding: 7,
                            resource:this.depthSampler,
                        }
                    ],
                },
            }
        );
        this.bCanvasReady = true;
    }

    /**
     * 渲染调试阴影贴图的全屏效果
     * 采用全屏绘制的方式，将阴影贴图输出
     * @param {number} DeltaTime 时间差
     * @param {GPUScene} Scene 场景（本 Pass 不用，但保持 API 一致）
     * @param {GPUCommandEncoder} CommandEncoder 命令编码器
     * @param {FDeferredShadingSceneRenderer} renderer 渲染器
     */
    async Render(DeltaTime, Scene, CommandEncoder, renderer) {

        while (!this.bCanvasReady||!this._bInitialized) {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }

        // 开始 compute pass
        const computePass = CommandEncoder.beginComputePass();

        // 设置 compute pipeline
        computePass.setPipeline(this.testPipeline);
        // 设置绑定的各个 BindGroup：
        //  0 - sceneBuffer（由 renderer.Scene.sceneBindGroup 提供）
        //  1 - 本 Pass 的 BindGroup（已经在 OnRenderTargetResize 中创建）
        //  2 - sceneLight（由 renderer.Scene.sceneLightBindGroup 提供）
        computePass.setBindGroup(0, renderer.Scene.sceneBindGroup, [0]);
        computePass.setBindGroup(1, this.testBindGroup);
        computePass.setBindGroup(2, renderer.Scene.sceneLightBindGroup);

        // 使用 OnRenderTargetResize 中保存的宽高来计算工作组数量
        const workgroupsX = Math.ceil(this.width / 8);
        const workgroupsY = Math.ceil(this.height / 8);

        // 分派 compute shader 任务
        computePass.dispatchWorkgroups(workgroupsX, workgroupsY,1);
        computePass.end();
    }

    /**
     * 销毁资源
     */
    async Destroy() {}
}

export default TestShadowRender;
