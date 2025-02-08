import FPass from '../Pass';
import ShaderIncluder from '../../../../Core/Shader/ShaderIncluder';
import FResourceManager from '../../../../Core/Resource/FResourceManager';
import StaticMesh from '../../../../Mesh/StaticMesh';
import FDeferredShadingSceneRenderer from '../../FDeferredShadingSceneRenderer';
import GPUScene from '../../../../Scene/GPUScene';
//执行预深度计算
class PrePass extends FPass {
    /**
     * 储存StaticMesh的渲染资源
     * @type {Map<string, FStaticMesh>}
     */
    StaticMeshes = new Map();

    constructor() {
        super();
        this._Name = 'PrePass';
        /**
         * 渲染目标纹理名称
         * @type {string}
         */
        this.RenderTargetTexture = 'Early-zDepthTexture';

        /**
         * 静态网格渲染管线
         * @type {string}
         */
        this.staticMeshesPipeLine = 'PrePassPipeline';

        /**
         * 骨骼网格渲染管线
         * @type {string}
         */
        this.skeletalMeshPipeLine = 'PrePassSkeletalPipeline';

        /**
         * 骨骼网格的存储
         * @type {Map<string, FSkeletalMesh>}
         */
        this.SkeletalMeshes = new Map();

        this.SceneVerson = -1;
    }

    /**
     * 初始化资源名称
     * 配置该Pass需要的资源
     */
    async InitResourceName() {
        this._Resources = {
            PassName: this._Name,
            Resources: {
                Dependence: {},
                Managed: {
                    Texture: [this.RenderTargetTexture],
                    Pipeline: [this.staticMeshesPipeLine, this.skeletalMeshPipeLine],
                },
                Output: {
                    Texture: [this.RenderTargetTexture],
                },
            },
        };
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

        // 创建深度纹理
        await this._ResourceManager.CreateResource(this.RenderTargetTexture, {
            Type: 'Texture',
            desc: {
                size: [1920, 1080, 1],
                format: 'depth24plus',
                usage: GPUTextureUsage.RENDER_ATTACHMENT,
                sampleCount: 1,
                viewFormats: ['depth24plus'],
            },
        });

        // 加载着色器代码
        const shaderCode = await ShaderIncluder.GetShaderCode('/Shader/PrePass/PrePass.wgsl');

        // 创建着色器模块
        const shaderModule = await this._ResourceManager.CreateResource(
            `${this._Name}ShaderModule`,
            {
                Type: 'ShaderModule',
                desc: {
                    code: shaderCode,
                },
            }
        );

        const bgLayoutRes = this._ResourceManager.GetResource(renderer.Scene.resourceName.sceneBindGroupLayout);

        // 创建渲染管线，确保 pipelineLayout 中传入的是合法的 GPUBindGroupLayout 对象
        await this._ResourceManager.CreateResource(this.staticMeshesPipeLine, {
            Type: 'RenderPipeline',
            desc: {
                layout: device.createPipelineLayout({
                    bindGroupLayouts: [ bgLayoutRes ],
                }),
                vertex: {
                    module: shaderModule,
                    entryPoint: 'VSMain',
                    buffers: [StaticMesh.VertexBufferDesc],
                },
                primitive: {
                    topology: 'triangle-list',
                    cullMode: 'back',
                },
                depthStencil: {
                    depthWriteEnabled: true,
                    depthCompare: 'less',
                    format: 'depth24plus',
                },
                fragment: {
                    module: shaderModule,
                    entryPoint: 'FSMain',
                    targets: [], // Early-Z pass 不需要颜色输出
                },
            },
        });

        this._bInitialized = true;
    }

    /**
     * 处理渲染目标大小改变
     */
    async OnRenderTargetResize(Width, Height) {
        // 重新创建深度纹理
        await this._ResourceManager.CreateResource(this.RenderTargetTexture, {
            Type: 'Texture',
            desc: {
                size: [Width, Height, 1],
                format: 'depth24plus',
                usage:
                    GPUTextureUsage.RENDER_ATTACHMENT |
                    GPUTextureUsage.COPY_SRC |
                    GPUTextureUsage.TEXTURE_BINDING,
                sampleCount: 1,
                viewFormats: ['depth24plus'],
            },
        });
    }

    /**
     * 重新生成该Pass的渲染网格体分组
     * @param {GPUScene} scene
     */
    #ReGenerateMeshGroup(scene) {
        // 获取场景中所有的 GPU 网格资源（返回数组）
        const gpuMeshes = scene.GetAllMesh();

        // 创建新的映射来记录当前有效的网格
        const currentStaticMeshes = new Map();
        const currentSkeletalMeshes = new Map();

        // 遍历所有 GPU 网格资源
        for (const gpuMesh of gpuMeshes) {
            const meshID = gpuMesh.meshID;
            // TODO: 根据网格类型分类存储，目前统统作为静态网格处理
            currentStaticMeshes.set(meshID, gpuMesh);

            // 如果这个网格不在我们的 StaticMeshes 中，添加它
            if (!this.StaticMeshes.has(meshID)) {
                this.StaticMeshes.set(meshID, gpuMesh);
            }
        }

        // 清理已经不在场景中的网格
        for (const [id, mesh] of this.StaticMeshes) {
            if (!currentStaticMeshes.has(id)) {
                this.StaticMeshes.delete(id);
            }
        }

        // TODO: 清理骨骼网格（当前未实现分类，将来根据需要实现）
        for (const [id, mesh] of this.SkeletalMeshes) {
            if (!currentSkeletalMeshes.has(id)) {
                this.SkeletalMeshes.delete(id);
            }
        }
    }

    /**
     * 渲染
     * @param {number} DeltaTime 时间差
     * @param {GPUScene} Scene 场景
     * @param {GPUCommandEncoder} CommandEncoder 命令编码器
     * @param {FDeferredShadingSceneRenderer} renderer 渲染器
     */
    async Render(DeltaTime, Scene, CommandEncoder, renderer) {
        // 此处原先通过 Scene.verson 判断是否需要重新生成网格分组，
        // 由于 GPUScene 已不再提供 verson 属性，故直接每帧重新生成网格组
        this.#ReGenerateMeshGroup(Scene);

        const depthTexture = this._ResourceManager.GetResource(this.RenderTargetTexture);
        const device = await this._ResourceManager.GetDevice();

        if (!depthTexture || !device) {
            console.warn('Required resources not ready for PrePass render');
            return;
        }

        const renderPassDescriptor = {
            colorAttachments: [],
            depthStencilAttachment: {
                view: depthTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
            },
        };

        // 开始渲染
        const passEncoder = CommandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setPipeline(this._ResourceManager.GetResource(this.staticMeshesPipeLine));

        //await Scene.debugCheckSceneBuffer();
        // 对每个网格进行渲染
        for (const [id, gpuMesh] of this.StaticMeshes) {
            // 设置该网格对应的动态偏移（用于访问 MeshInfo storage buffer 中不同 mesh 信息）
            const dynamicOffsets = [Scene.getMeshOffset(gpuMesh.meshID)];

            //await Scene.debugCheckMeshInfo(gpuMesh.meshID);
            // 使用 GPUScene 合并后的 bindGroup（sceneBindGroup）绑定资源，同时传入动态偏移数组
            passEncoder.setBindGroup(0, Scene.sceneBindGroup, dynamicOffsets);
            passEncoder.setVertexBuffer(0, gpuMesh.GPUVertexBuffer);
            passEncoder.setIndexBuffer(gpuMesh.GPUIndexBuffer, 'uint16');
            passEncoder.drawIndexed(gpuMesh.geometry.index.count, 1, 0, 0, 0);
        }

        passEncoder.end();
    }

    /**
     * 销毁资源
     */
    async Destroy() {
        this._ResourceManager.DeleteResource(this.RenderTargetTexture);
        this._ResourceManager.DeleteResource(`${this._Name}Pipeline`);
        this._ResourceManager.DeleteResource(`${this._Name}ShaderModule`);
    }
}

export default PrePass;
