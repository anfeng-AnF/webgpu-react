import FPass from '../Pass';
import FResourceManager from '../../../../Core/Resource/FResourceManager';
import PrePass from './PrePass';
import { GPUTextureFormat } from 'three/src/renderers/webgpu/utils/WebGPUConstants.js';
import ShaderIncluder from '../../../../Core/Shader/ShaderIncluder';
import GPUScene from '../../../../Scene/GPUScene';
import { resourceName } from '../../ResourceNames';
import StaticMesh from '../../../../Object3D/Mesh/StaticMesh';
/**
 * BasePass,渲染GBuffer
 */
class BasePass extends FPass {
    /**
     * GbufferA worldNormal
     * @type {string}
     */
    GBufferA = resourceName.BasePass.gBufferA;
    /**
     * Specular,Roughness,Metallic
     * @type {string}
     */
    GBufferB = resourceName.BasePass.gBufferB;
    /**
     * GbufferC BaseColor
     * @type {string}
     */
    GBufferC = resourceName.BasePass.gBufferC;
    /**
     * GbufferD Additional
     * @type {string}
     */
    GBufferD = resourceName.BasePass.gBufferD;

    /**
     * 储存StaticMesh的渲染资源
     * @type {Map<string, FStaticMesh>}
     */
    StaticMeshes = new Map();

    /**
     * 骨骼网格的存储
     * @type {Map<string, FSkeletalMesh>}
     */
    SkeletalMeshes = new Map();

    /**
     * 场景版本号，用于检测场景是否需要更新
     * @type {number}
     */
    SceneVerson = -1;

    constructor() {
        super();
        this._Name = 'BasePass';

        /**
         * 静态网格渲染管线
         * @type {string}
         */
        this.staticMeshesPipeLine = resourceName.BasePass.staticMeshPipeline;

        /**
         * 骨骼网格渲染管线
         * @type {string}
         */
        this.skeletalMeshPipeLine = resourceName.BasePass.skeletalMeshPipeline;
    }

    /**
     * 初始化资源名称
     * 配置该Pass需要的资源
     */
    async InitResourceName() {
        this._Resources = {
            PassName: this._Name,
            Resources: {
                Dependence: {
                    Texture: [resourceName.PrePass.depthTexture],
                },
                Managed: {
                    Texture: [
                        this.GBufferA,
                        this.GBufferB,
                        this.GBufferC,
                        this.GBufferD,
                    ],
                    Pipeline: [this.staticMeshesPipeLine, this.skeletalMeshPipeLine],
                },
                Output: {
                    Texture: [
                        this.GBufferA,
                        this.GBufferB,
                        this.GBufferC,
                        this.GBufferD,
                    ],
                },
            },
        };
    }

    /**
     * 重新生成该Pass的渲染网格体分组
     * @param {FScene} scene
     */
    #ReGenerateMeshGroup(scene) {
        // 获取场景中所有的GPU网格资源
        const gpuMeshes = scene.GetAllGpuMeshes();

        // 创建新的映射来记录当前有效的网格
        const currentStaticMeshes = new Map();
        const currentSkeletalMeshes = new Map();

        // 遍历所有GPU网格资源
        for (const [id, gpuMesh] of gpuMeshes) {
            // TODO: 根据网格类型分类存储
            // 暂时都作为静态网格处理
            currentStaticMeshes.set(id, gpuMesh);

            if (!this.StaticMeshes.has(id)) {
                this.StaticMeshes.set(id, gpuMesh);
            }
        }

        // 清理已经不在场景中的网格
        for (const [id, mesh] of this.StaticMeshes) {
            if (!currentStaticMeshes.has(id)) {
                this.StaticMeshes.delete(id);
            }
        }

        // TODO: 清理骨骼网格
        for (const [id, mesh] of this.SkeletalMeshes) {
            if (!currentSkeletalMeshes.has(id)) {
                this.SkeletalMeshes.delete(id);
            }
        }
    }

    /**
     * 初始化渲染通道
     * @param {FDeferredShadingSceneRenderer} renderer 渲染器
     */
    async Initialize(renderer) {
        if (!this._ResourceManager) {
            this._ResourceManager = FResourceManager.GetInstance();
        }

        const device = await this._ResourceManager.GetDevice();

        // 创建GBuffer纹理
        await this.OnRenderTargetResize(1920, 1080);

        // 创建staticmesh的shader
        const code = await ShaderIncluder.GetShaderCode('/Shader/BasePass/BasePassPBR.wgsl');
        const staticMeshShader = await this._ResourceManager.CreateResource(
            resourceName.BasePass.shaderModule,
            {
                Type: 'ShaderModule',
                desc: {
                    code: code,
                },
            }
        );

        // 创建采样器和纹理的BindGroupLayout
        const samplerTextureBGLayout = await this._ResourceManager.CreateResource(
            resourceName.BasePass.samplerTextureBGLayout,
            {
                Type: 'BindGroupLayout',
                desc: {
                    entries: [
                        {
                            binding: 0,
                            visibility: GPUShaderStage.FRAGMENT,
                            texture: {
                                sampleType: 'float', // 浮动精度的 2D 纹理
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
                        {
                            binding: 5,
                            visibility: GPUShaderStage.FRAGMENT,
                            sampler: {}, // 默认的 sampler 设置
                        },
                        {
                            binding: 6,
                            visibility: GPUShaderStage.FRAGMENT,
                            sampler: {},
                        },
                        {
                            binding: 7,
                            visibility: GPUShaderStage.FRAGMENT,
                            sampler: {},
                        },
                        {
                            binding: 8,
                            visibility: GPUShaderStage.FRAGMENT,
                            sampler: {},
                        },
                        {
                            binding: 9,
                            visibility: GPUShaderStage.FRAGMENT,
                            sampler: {},
                        },
                    ],
                },
            }
        );

        // 创建PipelineLayout
        const pipelineLayout = await this._ResourceManager.CreateResource(
            resourceName.BasePass.basePassPipelineLayout,
            {
                Type: 'PipelineLayout',
                desc: {
                    bindGroupLayouts: [
                        this._ResourceManager.GetResource(resourceName.Scene.sceneBindGroupLayout),
                        samplerTextureBGLayout,
                    ],
                },
            }
        );

        // 创建静态网格渲染管线
        await this._ResourceManager.CreateResource(this.staticMeshesPipeLine, {
            Type: 'RenderPipeline',
            desc: {
                layout: pipelineLayout,
                vertex: {
                    module: staticMeshShader,
                    entryPoint: 'VSMain',
                    buffers: [StaticMesh.VertexBufferDesc],
                },
                fragment: {
                    module: staticMeshShader,
                    entryPoint: 'PSMain',
                    targets: [
                        {
                            format: 'rgb10a2unorm',
                            sampleCount: 1, 
                        },
                        {
                            format: 'rgba8unorm',
                            sampleCount: 1,
                        },
                        {
                            format: 'rgba8unorm',
                            sampleCount: 1,
                        },
                        {
                            format: 'rgba8unorm',
                            sampleCount: 1,
                        },
                    ],
                },
                primitive: {
                    topology: 'triangle-list',
                    cullMode: 'back',
                },
                depthStencil: {
                    depthWriteEnabled: false,
                    depthCompare: 'less-equal',
                    format: 'depth24plus',
                },
            },
        });

        this._bInitialized = true;
    }

    /**
     * 处理渲染目标大小改变
     * @param {number} Width 宽度
     * @param {number} Height 高度
     */
    async OnRenderTargetResize(Width, Height) {

        const GBufferUsage =
            GPUTextureUsage.RENDER_ATTACHMENT |
            GPUTextureUsage.COPY_SRC |
            GPUTextureUsage.TEXTURE_BINDING;

        // GBufferA - 世界空间法线 (RGB)
        await this._ResourceManager.CreateResource(this.GBufferA, {
            Type: 'Texture',
            desc: {
                size: [Width, Height, 1],
                format: 'rgb10a2unorm',  // 使用小写格式名称
                usage: GBufferUsage,
                sampleCount: 1,
            },
        });

        // GBufferB - Specular(R),Roughness(G),Metallic(B)
        await this._ResourceManager.CreateResource(this.GBufferB, {
            Type: 'Texture',
            desc: {
                size: [Width, Height, 1],
                format: GPUTextureFormat.RGBA8Unorm, // 标准8位格式足够存储这些参数
                usage: GBufferUsage,
                sampleCount: 1,
            },
        });

        // GBufferC - BaseColor (RGBA)
        await this._ResourceManager.CreateResource(this.GBufferC, {
            Type: 'Texture',
            desc: {
                size: [Width, Height, 1],
                format: GPUTextureFormat.RGBA8Unorm, // 标准8位格式用于基础颜色
                usage: GBufferUsage,
                sampleCount: 1,
            },
        });

        // GBufferD - 预留
        await this._ResourceManager.CreateResource(this.GBufferD, {
            Type: 'Texture',
            desc: {
                size: [Width, Height, 1],
                format: GPUTextureFormat.RGBA8Unorm,
                usage: GBufferUsage,
                sampleCount: 1,
            },
        });
    }

    /**
     * 渲染
     * @param {number} DeltaTime 时间差
     * @param {GPUScene} Scene 场景
     * @param {GPUCommandEncoder} CommandEncoder 命令编码器
     * @param {FDeferredShadingSceneRenderer} renderer 渲染器
     */
    async Render(DeltaTime, Scene, CommandEncoder, renderer) {
        // 获取场景的深度纹理
        const depthTexture = await this._ResourceManager.GetResource(
            resourceName.PrePass.depthTexture
        );

        const RenderPassDesc = {
            depthStencilAttachment: {
                view: depthTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'load',    // 加载PrePass生成的深度值
                depthStoreOp: 'store',  // 修改这里：保存深度值而不是丢弃
            },
            colorAttachments: [
                {
                    view: this._ResourceManager.GetResource(this.GBufferA).createView(),
                    loadOp: 'clear',
                    storeOp: 'store',
                    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                    sampleCount: 1,
                },
                {
                    view: this._ResourceManager.GetResource(this.GBufferB).createView(),
                    loadOp: 'clear',
                    storeOp: 'store',
                    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                    sampleCount: 1,
                },
                {
                    view: this._ResourceManager.GetResource(this.GBufferC).createView(),
                    loadOp: 'clear',
                    storeOp: 'store',
                    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                    sampleCount: 1,
                },
                {
                    view: this._ResourceManager.GetResource(this.GBufferD).createView(),
                    loadOp: 'clear',
                    storeOp: 'store',
                    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                    sampleCount: 1,
                },
            ],
        };

        const passEncoder = CommandEncoder.beginRenderPass(RenderPassDesc);
        // 简单渲染处理，当前Scene中所有mesh材质均相同
        passEncoder.setPipeline(this._ResourceManager.GetResource(this.staticMeshesPipeLine));

        const meshes = Scene.GetAllMesh();
        for (const mesh of meshes) {
            const dynamicOffset = Scene.getMeshOffset(mesh.meshID);
            passEncoder.setBindGroup(0, Scene.sceneBindGroup, [dynamicOffset]);
            passEncoder.setBindGroup(1, mesh.GPUMaterial.GPUMaterial.bindGroup);

            //Scene.debugCheckMeshInfo(mesh.meshID);
            passEncoder.setVertexBuffer(0, mesh.GPUVertexBuffer);
            passEncoder.setIndexBuffer(mesh.GPUIndexBuffer, 'uint16');

            passEncoder.drawIndexed(mesh.geometry.index.count, 1, 0, 0, 0);
        }

        passEncoder.end();
    }

    /**
     * 销毁资源
     */
    async Destroy() {
        // TODO: 实现资源的销毁
    }
}

export default BasePass;
