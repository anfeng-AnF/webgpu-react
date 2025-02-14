import FPass from '../Pass';
import FResourceManager from '../../../../Core/Resource/FResourceManager';
import ShaderIncluder from '../../../../Core/Shader/ShaderIncluder';
import { resourceName } from '../../ResourceNames';
import StaticMesh from '../../../../Object3D/Mesh/StaticMesh';
import GPUScene from '../../../../Scene/GPUScene';

/**
 * ShadowMapPass
 *
 * 用于生成阴影贴图的渲染通道，通过从光源视角渲染深度，后续可以用于阴影计算。
 *
 * ShadowMapPass 会：
 *   1. 初始化时创建阴影贴图纹理（深度纹理）与对应的渲染管线。
 *   2. 在 Render() 中遍历所有需要投射阴影的 mesh，将深度写入阴影贴图中。
 *   3. 提供 Destroy() 接口清理 GPU 资源。
 *
 * @class ShadowMapPass
 * @extends FPass
 */
class ShadowMapPass extends FPass {
    /**
     * 阴影贴图纹理名称
     * @type {string}
     */
    shadowMapTarget = 'DirectLightShadowMap';

    /**
     * 创建 ShadowMapPass 的实例
     */
    constructor() {
        super();
        this._Name = 'ShadowMapPass';
    }

    /**
     * 初始化资源名称，配置该 Pass 所需的依赖与托管资源。
     *
     * @async
     * @returns {Promise<void>}
     */
    async InitResourceName() {
        this._Resources = {
            PassName: this._Name,
            Resources: {
                Dependence: {
                    // 如果需要依赖外部资源（例如光源的摄像机数据），在此配置
                },
                Managed: {
                    Texture: [this.shadowMapTarget],
                    Pipeline: [resourceName.LightPass.shadowMapPipeline],
                },
                Output: {
                    Texture: [this.shadowMapTarget],
                },
            },
        };
    }

    /**
     * 初始化阴影贴图渲染通道，包括创建阴影贴图纹理、加载阴影着色器、配置渲染管线。
     *
     * @param {FDeferredShadingSceneRenderer} renderer - 渲染器实例
     * @async
     * @returns {Promise<void>}
     */
    async Initialize(renderer) {
        if (!this._ResourceManager) {
            this._ResourceManager = FResourceManager.GetInstance();
        }
        const device = await this._ResourceManager.GetDevice();

        // 创建阴影贴图纹理资源，通常使用深度格式（例如 depth32float）
        await this._ResourceManager.CreateResource(this.shadowMapTarget, {
            Type: 'Texture',
            desc: {
                size: [4096, 4096, 1],
                format: 'depth32float',
                usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
                sampleCount: 1,
            },
        });

        // 加载阴影贴图所需的着色器代码（路径可根据实际情况调整）
        const shaderCode = await ShaderIncluder.GetShaderCode('/Shader/LightPass/LightPassDepth.wgsl');
        // 创建阴影着色器模块
        const shadowShader = await this._ResourceManager.CreateResource(
            '/Shader/LightPass/LightPassDepth.wgsl',
            {
                Type: 'ShaderModule',
                desc: {
                    code: shaderCode,
                },
            }
        );

        // 创建 PipelineLayout，绑定组中传入场景的 bindGroupLayout（例如包含光源、阴影摄像机矩阵等信息的资源）
        const pipelineLayout = await this._ResourceManager.CreateResource(
            resourceName.LightPass.shadowMapPipelineLayout,
            {
                Type: 'PipelineLayout',
                desc: {
                    bindGroupLayouts: [
                        // 这里假设场景中已经设置了 sceneBindGroupLayout
                        this._ResourceManager.GetResource(resourceName.Scene.sceneBindGroupLayout),
                        this._ResourceManager.GetResource('placeholder_BindGroupLayout'),
                        renderer.Scene.sceneLightBindGroupLayout,
                    ],
                },
            }
        );

        // 创建阴影贴图渲染管线，此处仅需要深度输出，因此不设置 fragment 阶段
        await this._ResourceManager.CreateResource(resourceName.LightPass.shadowMapPipeline, {
            Type: 'RenderPipeline',
            desc: {
                layout: pipelineLayout,
                vertex: {
                    module: shadowShader,
                    entryPoint: 'VSMain',
                    buffers: [StaticMesh.VertexBufferDesc],
                },
                // 阴影通道不需要颜色输出，只输出深度
                primitive: {
                    topology: 'triangle-list',
                    cullMode: 'back',
                },
                depthStencil: {
                    depthWriteEnabled: true,
                    depthCompare: 'less',
                    format: 'depth32float',
                },
            },
        });

        this._bInitialized = true;
    }

    /**
     * 渲染阴影贴图，将所有需要产生阴影的网格从光源视角写入深度纹理中。
     *
     * @param {number} DeltaTime - 时间差
     * @param {GPUScene} Scene - GPU 场景
     * @param {GPUCommandEncoder} CommandEncoder - 命令编码器
     * @param {FDeferredShadingSceneRenderer} renderer - 渲染器
     * @async
     * @returns {Promise<void>}
     */
    async Render(DeltaTime, Scene, CommandEncoder, renderer) {
        const device = await this._ResourceManager.GetDevice();
        const shadowTexture = this._ResourceManager.GetResource(this.shadowMapTarget);
        const pipeline = this._ResourceManager.GetResource(resourceName.LightPass.shadowMapPipeline);

        // 构建渲染通道描述，设置深度附件为阴影贴图（无颜色附件）
        const renderPassDesc = {
            colorAttachments: [],
            depthStencilAttachment: {
                view: shadowTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
            },
        };

        const passEncoder = CommandEncoder.beginRenderPass(renderPassDesc);
        // 设置渲染管线：阴影贴图 Pass 使用专用管线
        passEncoder.setPipeline(pipeline);

        // 绑定场景光照数据
        passEncoder.setBindGroup(1, this._ResourceManager.GetResource('placeholder_BindGroup'));
        passEncoder.setBindGroup(2, Scene.sceneLightBindGroup);

        // 遍历所有需要渲染阴影的网格，这里假设 GPUScene 提供 GetAllMesh() 和 getMeshOffset() 接口
        const meshes = Scene.GetAllMesh();
        for (const mesh of meshes) {
            const dynamicOffset = Scene.getMeshOffset(mesh.meshID);
            // 绑定场景数据，例如光源摄像机矩阵（传入动态偏移数组）
            passEncoder.setBindGroup(0, Scene.sceneBindGroup, [dynamicOffset]);
            passEncoder.setVertexBuffer(0, mesh.GPUVertexBuffer);
            passEncoder.setIndexBuffer(mesh.GPUIndexBuffer, 'uint16');
            passEncoder.drawIndexed(mesh.geometry.index.count, 1, 0, 0, 0);
        }

        passEncoder.end();
    }

    /**
     * 销毁 ShadowMapPass 的所有 GPU 资源
     *
     * @async
     * @returns {Promise<void>}
     */
    async Destroy() {
        this._ResourceManager.DeleteResource(this.shadowMapTarget);
        this._ResourceManager.DeleteResource(resourceName.LightPass.shadowMapPipeline);
        this._ResourceManager.DeleteResource(resourceName.LightPass.shadowMapShaderModule);
        this._ResourceManager.DeleteResource(resourceName.LightPass.shadowMapPipelineLayout);
    }

    /**
     * 渲染目标大小改变
     * @param {number} Width 宽度
     * @param {number} Height 高度
     */
    OnRenderTargetResize(Width, Height) {
        // 无与渲染目标相关资源
    }
}

export default ShadowMapPass;
