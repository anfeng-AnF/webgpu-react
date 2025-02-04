import FPass from '../Pass';
import ShaderIncluder from '../../../../Core/Shader/ShaderIncluder';
import FResourceManager from '../../../../Core/Resource/FResourceManager';
import FStaticMesh from '../../../../Mesh/StaticMesh';
import FDeferredShadingSceneRenderer from '../../FDeferredShadingSceneRenderer';
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
                    Pipeline: [
                        this.staticMeshesPipeLine,
                        this.skeletalMeshPipeLine
                    ],
                },
                Output: {
                    Texture: [this.RenderTargetTexture],
                },
            },
        };
    }

    /**
     * 初始化渲染通道
     * 创建深度纹理和渲染管线
     * @param {FDeferredShadingSceneRenderer} renderer 渲染器
     */
    async Initialize(renderer) {
        if (!this._ResourceManager) {
            this._ResourceManager = FResourceManager.GetInstance();
        }

        const device = await this._ResourceManager.GetDevice();

        // 确保场景的 SceneBuffer 已经创建
        const sceneBufferLayout = this._ResourceManager.GetResource(renderer.Scene.SceneBufferLayoutName);
        if (!sceneBufferLayout) {
            throw new Error('Scene buffer layout not initialized');
        }

        // 创建模型矩阵的 Uniform Buffer
        await this._ResourceManager.CreateResource('PrePassModelBuffer', {
            Type: 'Buffer',
            desc: {
                size: 16 * 4, // mat4x4 (16 floats)
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            }
        });

        // 创建 BindGroupLayout
        await this._ResourceManager.CreateResource('PrePassBindGroupLayout', {
            Type: 'BindGroupLayout',
            desc: {
                entries: [
                    {
                        binding: 0,
                        visibility: GPUShaderStage.VERTEX,
                        buffer: {
                            type: 'uniform'
                        }
                    }
                ]
            }
        });

        // 创建 BindGroup
        await this._ResourceManager.CreateResource('PrePassBindGroup', {
            Type: 'BindGroup',
            desc: {
                layout: this._ResourceManager.GetResource('PrePassBindGroupLayout'),
                entries: [
                    {
                        binding: 0,
                        resource: {
                            buffer: this._ResourceManager.GetResource('PrePassModelBuffer')
                        }
                    }
                ]
            }
        });

        // 创建深度纹理
        await this._ResourceManager.CreateResource(this.RenderTargetTexture, {
            Type: 'Texture',
            desc: {
                size: [1920, 1080, 1],
                format: 'depth24plus',
                usage: GPUTextureUsage.RENDER_ATTACHMENT,
                sampleCount: 1,
                viewFormats: ['depth24plus']
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

        // 创建渲染管线
        await this._ResourceManager.CreateResource(this.staticMeshesPipeLine, {
            Type: 'RenderPipeline',
            desc: {
                layout: device.createPipelineLayout({
                    bindGroupLayouts: [
                        sceneBufferLayout, // group(0) - scene buffer
                        this._ResourceManager.GetResource('PrePassBindGroupLayout') // group(1) - model matrix
                    ]
                }),
                vertex: {
                    module: shaderModule,
                    entryPoint: 'VSMain',
                    buffers: [FStaticMesh.VertexBufferDesc],
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
                }
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
                usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.TEXTURE_BINDING,
                sampleCount: 1,
                viewFormats: ['depth24plus']
            },
        });
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
            
            // 如果这个网格不在我们的StaticMeshes中，添加它
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

        const depthTexture = this._ResourceManager.GetResource(this.RenderTargetTexture);
        const modelBuffer = this._ResourceManager.GetResource('PrePassModelBuffer');
        const device = await this._ResourceManager.GetDevice();

        if (!depthTexture || !modelBuffer || !device) {
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

        const passEncoder = CommandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setBindGroup(0, renderer.Scene.SceneBufferBindGroup);
        
        // 处理静态网格体
        passEncoder.setPipeline(this._ResourceManager.GetResource(this.staticMeshesPipeLine));
        for(const [id, gpuMesh] of this.StaticMeshes) {
            if(!gpuMesh.bIndexedMesh) {
                console.warn(`Mesh ${id} not indexed mesh.`);
                continue;
            }
            
            // 确保模型矩阵是最新的
            gpuMesh.originalMesh.updateMatrix();
            gpuMesh.originalMesh.updateMatrixWorld(true);

            // 使用 Float32Array 直接从 matrixWorld 获取数据
            const modelMatrix = new Float32Array(gpuMesh.originalMesh.matrixWorld.elements);
            
            // 写入模型矩阵
            device.queue.writeBuffer(
                modelBuffer,
                0,
                modelMatrix
            );
            
            passEncoder.setBindGroup(1, this._ResourceManager.GetResource('PrePassBindGroup'));
            passEncoder.setVertexBuffer(0, this._ResourceManager.GetResource(gpuMesh.VertexBufferName));
            passEncoder.setIndexBuffer(this._ResourceManager.GetResource(gpuMesh.IndexBufferName), 'uint16');
            passEncoder.drawIndexed(gpuMesh.IndexCount, 1, 0, 0, 0);
        }

        // TODO: 处理骨骼网格体
        if(this.SkeletalMeshes.size > 0) {
            passEncoder.setPipeline(this._ResourceManager.GetResource(this.skeletalMeshPipeLine));
            // 骨骼网格的渲染逻辑将在这里实现
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
        this._ResourceManager.DeleteResource('PrePassModelBuffer');
        this._ResourceManager.DeleteResource('PrePassBindGroupLayout');
        this._ResourceManager.DeleteResource('PrePassBindGroup');
    }
}

export default PrePass;
