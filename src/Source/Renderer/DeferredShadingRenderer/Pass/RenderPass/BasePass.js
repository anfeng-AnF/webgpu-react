import FPass from '../Pass';
import FResourceManager from '../../../../Core/Resource/FResourceManager';
import FStaticMesh from '../../../../Mesh/StaticMesh';
import PrePass from './PrePass';
import { GPUTextureFormat } from 'three/src/renderers/webgpu/utils/WebGPUConstants.js';
import ShaderIncluder from '../../../../Core/Shader/ShaderIncluder';
/**
 * BasePass,渲染GBuffer
 */
class BasePass extends FPass {
    /**
     * GbufferA worldNormal
     * @type {string}
     */
    GBufferA = 'GBufferA';
    /**
     * Specular,Roughness,Metallic
     * @type {string}
     */
    GBufferB = 'GBufferB';
    /**
     * GbufferC BaseColor
     * @type {string}
     */
    GBufferC = 'GBufferC';
    /**
     * GbufferD Additional
     * @type {string}
     */
    GBufferD = 'GBufferD';
    /**
     * GbufferE Additional
     * @type {string}
     */
    GBufferE = 'GBufferE';

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
        this.staticMeshesPipeLine = 'BasePassPipeline';
        
        /**
         * 骨骼网格渲染管线
         * @type {string}
         */
        this.skeletalMeshPipeLine = 'BasePassSkeletalPipeline';
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
                    Texture: [
                        PrePass.Resources.Output
                    ],
                },
                Managed: {
                    Texture: [
                        this.GBufferA,
                        this.GBufferB,
                        this.GBufferC,
                        this.GBufferD,
                        this.GBufferE
                    ],
                    Pipeline: [
                        this.staticMeshesPipeLine,
                        this.skeletalMeshPipeLine
                    ],
                },
                Output: {
                    Texture: [
                        this.GBufferA,
                        this.GBufferB,
                        this.GBufferC,
                        this.GBufferD,
                        this.GBufferE
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

        // 创建GBuffer纹理
        await this.OnRenderTargetResize(renderer.Width, renderer.Height);

        this._bInitialized = true;
    }

    /**
     * 处理渲染目标大小改变
     * @param {number} Width 宽度
     * @param {number} Height 高度
     */
    async OnRenderTargetResize(Width, Height) {

        const GBufferUsage = GPUTextureUsage.RENDER_ATTACHMENT | 
        GPUTextureUsage.TEXTURE_BINDING | 
        GPUTextureUsage.COPY_SRC;

        // GBufferA - 世界空间法线 (RGB)
        this.GBufferA = await this._ResourceManager.CreateResource(this.GBufferA, {
            Type: 'Texture',
            desc: {
                size: [Width, Height, 1],
                format: GPUTextureFormat.RGB10A2UNORM,  // 高精度浮点格式用于法线
                usage: GBufferUsage,
                sampleCount: 1
            }
        });

        // GBufferB - Specular(R),Roughness(G),Metallic(B)
        this.GBufferB = await this._ResourceManager.CreateResource(this.GBufferB, {
            Type: 'Texture',
            desc: {
                size: [Width, Height, 1],
                format: GPUTextureFormat.RGBA8UNORM,   // 标准8位格式足够存储这些参数
                usage: GBufferUsage,
                sampleCount: 1
            }
        });

        // GBufferC - BaseColor (RGBA)
        this.GBufferC = await this._ResourceManager.CreateResource(this.GBufferC, {
            Type: 'Texture',
            desc: {
                size: [Width, Height, 1],
                format: GPUTextureFormat.RGBA8UNORM,   // 标准8位格式用于基础颜色
                usage: GBufferUsage,
                sampleCount: 1
            }
        });

        // GBufferD - 预留
        this.GBufferD = await this._ResourceManager.CreateResource(this.GBufferD, {
            Type: 'Texture',
            desc: {
                size: [Width, Height, 1],
                format: GPUTextureFormat.RGBA8UNORM,
                usage: GBufferUsage,
                sampleCount: 1
            }
        });

        // GBufferE - 预留
        this.GBufferE = await this._ResourceManager.CreateResource(this.GBufferE, {
            Type: 'Texture',
            desc: {
                size: [Width, Height, 1],
                format: GPUTextureFormat.RGBA8UNORM,
                usage: GBufferUsage,
                sampleCount: 1
            }
        });
    }

    /**
     * 渲染
     * @param {number} DeltaTime 时间差
     * @param {FScene} Scene 场景
     * @param {GPUCommandEncoder} CommandEncoder 命令编码器
     * @param {FDeferredShadingSceneRenderer} renderer 渲染器
     */
    async Render(DeltaTime, Scene, CommandEncoder, renderer) {
        if (this.SceneVerson !== Scene.verson) {
            this.#ReGenerateMeshGroup(Scene);
            this.SceneVerson = Scene.verson;
        }

        // 获取场景的深度纹理
        const depthTexture = await this._ResourceManager.GetResource(this.Resources.Dependence.Texture[0]);

        const RenderPassDesc = {
            depthStencilAttachment: {
                view: depthTexture.view,
                depthClearValue: 1.0,
                depthLoadOp: 'load',
                depthStoreOp: 'discard',
            },
            colorAttachments: [
                {
                    view: this.GBufferA.view,
                    loadOp: 'clear',
                    storeOp: 'store',
                },
                {
                    view: this.GBufferB.view,
                    loadOp: 'clear',
                    storeOp: 'store',
                },
                {
                    view: this.GBufferC.view,
                    loadOp: 'clear',
                    storeOp: 'store',
                },
                {
                    view: this.GBufferD.view,
                    loadOp: 'clear',
                    storeOp: 'store',
                },
                {
                    view: this.GBufferE.view,
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ]
        }

        const passEncoder = CommandEncoder.beginRenderPass(RenderPassDesc);
        // TODO: 实现GBuffer的渲染
    }

    /**
     * 销毁资源
     */
    async Destroy() {
        // TODO: 实现资源的销毁
    }
}

export default BasePass;

