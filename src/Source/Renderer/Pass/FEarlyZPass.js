import FPass from './FPass.js';
import { EResourceType } from '../../Core/Resource/FResourceManager.js';
import { ResourceConfig } from '../InitResource/DeferredRendering/ResourceConfig.js';
import { EMeshType as EmeshType, EMeshType } from '../../Mesh/EMeshType.js';
import { MeshBatch } from '../Meshbatch/MeshBatch.js';
import ShaderIncluder from '../../Core/Shader/ShaderIncluder.js';

class FEarlyZPass extends FPass {
    constructor(InName = 'EarlyZPass') {
        super(InName);
    }

    /**
     * 初始化资源名称配置
     * @protected
     */
    _initializeResourceNames() {
        this._resourceNames = {
            Shader: {
                Name: 'EarlyZPassShader',
                Path: 'Shader/DeferredShading/EarlyZPass.wgsl',
            },
            PipelineLayout: {
                StaticMesh: 'EarlyZPassStaticMeshPipelineLayout',
                SkeletalMesh: 'EarlyZPassSkeletalMeshPipelineLayout',
                InstancedMesh: 'EarlyZPassInstancedMeshPipelineLayout',
            },
            Pipeline: {
                StaticMesh: 'EarlyZPassStaticMeshPipeline',
                //SkeletalMesh: 'EarlyZPassSkeletalMeshPipeline',
                //InstancedMesh: 'EarlyZPassInstancedMeshPipeline',
            },
            DepthTexture: {
                Name: 'EarlyZSceneDepthTexture',
                Description: 'EarlyZ Pass的场景深度纹理',
            },
        };
    }

    /**
     * 声明Pass所需的资源
     * @protected
     */
    _declareResources() {
        // 这个Pass负责创建和管理深度纹理
    }

    /**
     * 验证资源是否就绪
     */
    ValidateResources() {
        const resources = [
            this._resourceNames.Shader.Name,
            this._resourceNames.Pipeline.StaticMesh,
            //this._resourceNames.Pipeline.SkeletalMesh,
            //this._resourceNames.Pipeline.InstancedMesh,
            this._resourceNames.DepthTexture.Name,
        ];

        for (const name of resources) {
            if (!this._resourceManager.GetResource(name)) {
                console.error(`EarlyZPass: Resource "${name}" not found`);
                return false;
            }
        }
        return true;
    }

    /**
     * 执行渲染通道
     * @param {GPURenderPassEncoder} commandEncoder
     * @param {Array<MeshBatch>} batchedMeshes
     */
    Execute(commandEncoder, batchedMeshes) {
        if (!this.ValidateResources()) {
            return;
        }
        const t =  this._resourceManager
                    .GetResource(this._resourceNames.DepthTexture.Name);
        // 创建深度纹理的渲染通道
        const passEncoder = commandEncoder.beginRenderPass({
            colorAttachments: [],
            depthStencilAttachment: {
                view: this._resourceManager
                    .GetResource(this._resourceNames.DepthTexture.Name)
                    .createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear', // 在开始渲染时清除深度
                depthStoreOp: 'store', // 渲染结束时将深度值存储到纹理中
            },
        });

        // 遍历所有批次的网格
        for (const meshBatch of batchedMeshes) {
            switch (meshBatch.GetMeshType()) {
                case EMeshType.Static:
                    meshBatch.SetPipeline(this._resourceNames.Pipeline.StaticMesh);
                    break;
                case EMeshType.Instanced:
                    meshBatch.SetPipeline(this._resourceNames.Pipeline.InstancedMesh);
                    break;
                case EMeshType.Skeletal:
                    meshBatch.SetPipeline(this._resourceNames.Pipeline.SkeletalMesh);
                    break;
                    default:
                        break;
            }
            meshBatch.Draw(passEncoder, this._name);
        }
        passEncoder.end();
    }

    /**
     * 初始化该pass的默认资源
     * @param {number} width
     * @param {number} height
     */
    async Initialize(width, height) {
        const sceneBuffers = ResourceConfig.GetSceneBuffers();

        try {
            // 1. 创建Shader
            const shaderCode = await ShaderIncluder.GetShaderCode(this._resourceNames.Shader.Path);
            const shader = this._resourceManager.CreateResource(this._resourceNames.Shader.Name, {
                Type: EResourceType.ShaderModule,
                desc: { code: shaderCode },
            });



            // 2. 创建Pipelines
            //const meshTypes = ['StaticMesh', 'SkeletalMesh', 'InstancedMesh'];
            const meshTypes = ['StaticMesh'];
            for (const type of meshTypes) {
                //创建PipelineLayout
                //创建Pipeline
                const layout = [];
                const buffers = [];
                if (type === 'StaticMesh') {
                    buffers.push(ResourceConfig.GetStaticMeshLayout());
                    layout.push(this._resourceManager.GetResource(sceneBuffers.layoutName));
                } 
                else if(type === 'SkeletalMesh')
                {
                    buffers.push(ResourceConfig.GetSkeletalMeshLayout());
                    layout.push(this._resourceManager.GetResource(sceneBuffers.layoutName));
                }
                else if(type === 'InstancedMesh'){
                    buffers.push(ResourceConfig.GetStaticMeshLayout());
                    layout.push(this._resourceManager.GetResource(sceneBuffers.layoutName));
                }

                this._resourceManager.CreateResource(this._resourceNames.PipelineLayout[type], {
                    Type: EResourceType.PipelineLayout,
                    desc: {
                        bindGroupLayouts: layout,
                    },
                });
                
                this._resourceManager.CreateResource(this._resourceNames.Pipeline[type], {
                    Type: EResourceType.RenderPipeline,
                    desc: {
                        layout: this._resourceManager.GetResource(this._resourceNames.PipelineLayout[type]),
                        vertex: {
                            module: shader,
                            entryPoint: `vs${type}`,
                            buffers,
                        },
                        fragment: {
                            module: shader,
                            entryPoint: 'fsMain',
                            targets: [],
                        },
                        depthStencil: {
                            format: 'depth24plus',
                            depthWriteEnabled: true,
                            depthCompare: 'less',
                        },
                        primitive: {
                            topology: 'triangle-list',
                            cullMode: 'back',
                        },
                    },
                });
            }

            // 3. 创建深度纹理
            // 注意：尺寸将在 OnCanvasResize 中设置
            this._resourceManager.CreateResource(this._resourceNames.DepthTexture.Name, {
                Type: EResourceType.Texture,
                desc: {
                    size: [1, 1], // 临时尺寸
                    format: 'depth24plus',
                    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
                },
            });
        } catch (error) {
            console.error(`EarlyZPass initialization failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * 处理Canvas尺寸变化
     * @param {number} width 新的宽度
     * @param {number} height 新的高度
     */
    async OnCanvasResize(width, height) {
        // 重新创建深度纹理
        if (this._resourceManager.HasResource(this._resourceNames.DepthTexture.Name)) {
            this._resourceManager.DeleteResource(this._resourceNames.DepthTexture.Name);
        }

        this._resourceManager.CreateResource(this._resourceNames.DepthTexture.Name, {
            Type: EResourceType.Texture,
            desc: {
                size: [width, height],
                format: 'depth24plus',
                usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
            },
        });
    }

    /**
     * 获取Pass的默认输出Texture资源名
     * @returns {string} 默认输出Texture资源名 'null'表示没有默认输出Texture
     */
    GetDefaultOutputTextureName() {
        return this._resourceNames.DepthTexture.Name;
    }
}

export default FEarlyZPass;
