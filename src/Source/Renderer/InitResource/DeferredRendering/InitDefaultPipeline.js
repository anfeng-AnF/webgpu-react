import FResourceManager, { EResourceType } from '../../../Core/Resource/FResourceManager.js';
import { ResourceConfig } from './ResourceConfig.js';
import ShaderIncluder from '../../../Core/Shader/ShaderIncluder.js';

class InitDefaultPipeline {
    static #resourceManager = FResourceManager.GetInstance();

    /*
     * 初始化基本资源如 相机参数的UniformBuffer
     */
    static async #InitializeBaseResources() {
        const sceneBuffer = ResourceConfig.GetSceneBuffers();
        try {
            // 1. 创建各个UniformBuffer
            // 创建VP矩阵UniformBuffer
            this.#resourceManager.CreateResource(sceneBuffer.matrices.name, {
                Type: EResourceType.Buffer,
                desc: {
                    size: sceneBuffer.matrices.totalSize,
                    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
                    mappedAtCreation: false,
                },
                Metadata: {
                    type: 'uniform',
                    usage: 'matrices',
                    values: Object.entries(sceneBuffer.matrices.values).map(([key, value]) => ({
                        name: value.name,
                        type: value.type,
                        offset: value.offset,
                    })),
                    totalSize: sceneBuffer.matrices.totalSize,
                },
            });

            // 创建相机属性UniformBuffer
            this.#resourceManager.CreateResource(sceneBuffer.camera.name, {
                Type: EResourceType.Buffer,
                desc: {
                    size: sceneBuffer.camera.totalSize,
                    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
                    mappedAtCreation: false,
                },
                Metadata: {
                    type: 'uniform',
                    usage: 'camera',
                    values: Object.entries(sceneBuffer.camera.values).map(([key, value]) => ({
                        name: value.name,
                        type: value.type,
                        offset: value.offset,
                    })),
                    totalSize: sceneBuffer.camera.totalSize,
                },
            });

            // 创建场景参数UniformBuffer
            this.#resourceManager.CreateResource(sceneBuffer.Scene.name, {
                Type: EResourceType.Buffer,
                desc: {
                    size: sceneBuffer.Scene.totalSize,
                    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
                    mappedAtCreation: false,
                },
                Metadata: {
                    type: 'uniform',
                    usage: 'scene',
                    values: Object.entries(sceneBuffer.Scene.values).map(([key, value]) => ({
                        name: value.name,
                        type: value.type,
                        offset: value.offset,
                    })),
                    totalSize: sceneBuffer.Scene.totalSize,
                },
            });

            //场景基本数据创建
            this.#resourceManager.CreateResource(ResourceConfig.GetSceneBuffers().layoutName, {
                Type: EResourceType.BindGroupLayout,
                desc: {
                    entries: [
                        {
                            binding: 0,
                            visibility: GPUShaderStage.VERTEX,
                            buffer: { type: 'uniform' },
                        },
                        {
                            binding: 1,
                            visibility: GPUShaderStage.VERTEX,
                            buffer: { type: 'uniform' },
                        },
                        {
                            binding: 2,
                            visibility: GPUShaderStage.VERTEX,
                            buffer: { type: 'uniform' },
                        },
                    ],
                },
            });

            // 2. 创建SceneBuffer的BindGroup
            this.#resourceManager.CreateResource(sceneBuffer.name, {
                Type: EResourceType.BindGroup,
                desc: {
                    layout: this.#resourceManager.GetResource(
                        ResourceConfig.GetSceneBuffers().layoutName
                    ),
                    entries: [
                        {
                            binding: 0,
                            resource: {
                                buffer: this.#resourceManager.GetResource(sceneBuffer.matrices.name),
                            },
                        },
                        {
                            binding: 1,
                            resource: {
                                buffer: this.#resourceManager.GetResource(sceneBuffer.camera.name),
                            },
                        },
                        {
                            binding: 2,
                            resource: {
                                buffer: this.#resourceManager.GetResource(sceneBuffer.Scene.name),
                            },
                        },
                    ],
                },
            });

            console.log('Base resources initialized successfully');
        } catch (error) {
            console.error('Failed to initialize base resources:', error);
            throw error;
        }
    }

    /**
     * 初始化EarlyZ Pass的渲染管线
     */
    static async #InitializeEarlyZPipelines() {
        try {
            // EarlyZPassShader 已经是导入的代码字符串
            const processedShaderCode = await ShaderIncluder.GetShaderCode('Shader/DeferredShading/EarlyZPass.wgsl');

            const shader = this.#resourceManager.CreateResource('EarlyZPassShader', {
                Type: EResourceType.ShaderModule,
                desc: { code: processedShaderCode },
            });

            // 2. 创建不同类型网格的Pipeline
            const pipelineTypes = ['StaticMesh', 'SkeletalMesh'];
            
            for (const type of pipelineTypes) {
                const buffers = [];
                
                // 添加基本顶点布局
                if (type === 'StaticMesh') {
                    buffers.push(ResourceConfig.GetStaticMeshLayout());
                } else if (type === 'SkeletalMesh') {
                    buffers.push(ResourceConfig.GetSkeletalMeshLayout());
                }

                // 创建Pipeline
                this.#resourceManager.CreateResource(
                    `EarlyZPass${type}Pipeline`,
                    {
                        Type: EResourceType.RenderPipeline,
                        desc: {
                            layout: 'auto',  // 使用自动布局
                            vertex: {
                                module: shader,
                                entryPoint: `vs${type}`,
                                buffers
                            },
                            fragment: {
                                module: shader,
                                entryPoint: 'fsMain',
                                targets: [
                                    {
                                        format: 'rgba8unorm',
                                        writeMask: 0
                                    }
                                ]
                            },
                            depthStencil: {
                                format: 'depth24plus',
                                depthWriteEnabled: true,
                                depthCompare: 'less'
                            },
                            primitive: {
                                topology: 'triangle-list',
                                cullMode: 'back'
                            }
                        }
                    }
                );
            }

            console.log('EarlyZ Pass resources initialized successfully');
        } catch (error) {
            console.error('Failed to initialize EarlyZ Pass resources:', error);
            throw error;
        }
    }

    /**
     * 初始化延迟渲染管线
     */
    static async InitializeDeferredRenderPipeline() {
        try {
            await InitDefaultPipeline.#InitializeEarlyZPipelines();
            await InitDefaultPipeline.#InitializeBaseResources();
        } catch (error) {
            console.error('Failed to initialize deferred render pipeline:', error);
            throw error;
        }
    }

    /**
     * 根据Canvas尺寸创建或重新创建纹理资源
     * @param {HTMLCanvasElement} canvas - Canvas元素
     */
    static async InitializeDeferredRenderPipelineTextureByCanvas(canvas) {
        await this.InitializeDeferredRenderPipelineTextureByCanvasSize(canvas.width, canvas.height);
    }

    /**
     * 根据Canvas尺寸创建或重新创建纹理资源
     * @param {number} width - Canvas宽度
     * @param {number} height - Canvas高度
     */
    static async InitializeDeferredRenderPipelineTextureByCanvasSize(width, height) {
        try {
            const textureNames = ResourceConfig.GetAllTextureNameByCanvasSize();
            const size = {
                width,
                height,
                depthOrArrayLayers: 1,
            };

            // 遍历所有需要创建的纹理
            for (const textureName of textureNames) {
                // 获取纹理描述
                const textureDesc = ResourceConfig.GetBaseResourceDesc(textureName);
                if (!textureDesc) {
                    console.warn(`No texture description found for: ${textureName}`);
                    continue;
                }

                // 如果已存在，先删除旧的纹理
                if (this.#resourceManager.HasResource(textureName)) {
                    this.#resourceManager.DeleteResource(textureName);
                }

                // 创建新的纹理
                this.#resourceManager.CreateResource(textureName, {
                    Type: EResourceType.Texture,
                    desc: {
                        ...textureDesc,
                        size,
                        // 对于深度纹理，添加sampleCount
                        ...(textureName === 'EarlyZDepthTexture' ? { sampleCount: 1 } : {}),
                    },
                    Metadata: {
                        width,
                        height,
                        createdAt: Date.now(),
                    },
                });
            }

            console.log(
                `Canvas-dependent textures initialized successfully with size ${width}x${height}`
            );
        } catch (error) {
            console.error('Failed to initialize canvas-dependent textures:', error);
            throw error;
        }
    }
}

export default InitDefaultPipeline;
