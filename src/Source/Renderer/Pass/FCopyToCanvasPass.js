import FPass from './FPass.js';
import FResourceManager from '../../Core/Resource/FResourceManager.js';
import { EResourceType } from '../../Core/Resource/FResourceManager.js';
import ShaderIncluder from '../../Core/Shader/ShaderIncluder.js';


class FCopyToCanvasPass extends FPass {
    #context;
    #width;
    #height;
    #isDepthTexture = false;

    constructor(context, width, height) {
        super('CopyToCanvasPass');
        this.#context = context;
        this.#width = width;
        this.#height = height;
    }

    /**
     * 初始化资源名称配置
     * @protected
     */
    _initializeResourceNames() {
        this._resourceNames = {
            Source: {
                Name: null,  // 将在 SetSourceTexture 中设置
                Description: '需要拷贝到Canvas的源纹理'
            },
            Shader: {
                Name: 'CopyToCanvasShader',
                Path: 'Shader/PostProcess/DepthToColor.wgsl'
            },
            Pipeline: {
                Name: 'CopyToCanvasPipeline'
            },
            PipelineLayout: {
                Name: 'CopyToCanvasPipelineLayout'
            },
            BindGroup: {
                Name: 'CopyToCanvasBindGroup'
            },
            BindGroupLayout: {
                Name: 'CopyToCanvasBindGroupLayout'
            }
        };
    }

    /**
     * 声明Pass所需的资源
     * @protected
     */
    _declareResources() {
        // 这个Pass只需要一个源纹理资源
    }

    /**
     * 验证资源是否就绪
     */
    ValidateResources() {
        const sourceTexture = this._resourceManager.GetResource(this._resourceNames.Source.Name);
        if (!sourceTexture) {
            console.error('CopyToCanvasPass: Source texture not found');
            return false;
        }
        return true;
    }

    /**
     * 执行拷贝到Canvas的渲染Pass
     * @param {GPUCommandEncoder} commandEncoder 命令编码器
     */
    Execute(commandEncoder) {
        if (!this.ValidateResources()) {
            return;
        }

        const sourceTexture = this._resourceManager.GetResource(this._resourceNames.Source.Name);
        const isColorTexture = sourceTexture.format === 'rgba8unorm';

        if (isColorTexture) {
            // 直接拷贝颜色纹理到 Canvas
            commandEncoder.copyTextureToTexture(
                { texture: sourceTexture },
                { texture: this.#context.getCurrentTexture() },
                { width: this.#width, height: this.#height, depthOrArrayLayers: 1 }
            );
        } else {
            // 对深度纹理进行可视化处理
            const passEncoder = commandEncoder.beginRenderPass({
                colorAttachments: [{
                    view: this.#context.getCurrentTexture().createView(),
                    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                    loadOp: 'clear',
                    storeOp: 'store'
                }]
            });

            const pipeline = this._resourceManager.GetResource(this._resourceNames.Pipeline.Name);
            const bindGroup = this._resourceManager.GetResource(this._resourceNames.BindGroup.Name);

            passEncoder.setPipeline(pipeline);
            passEncoder.setBindGroup(0, bindGroup);
            passEncoder.draw(3, 1, 0, 0);
            passEncoder.end();
        }
    }

    /**
     * 初始化该pass的默认资源
     */
    async Initialize(width, height) {
        try {
            // 1. 加载并创建着色器
            const shaderCode = await ShaderIncluder.GetShaderCode(this._resourceNames.Shader.Path);
            const shader = this._resourceManager.CreateResource(
                this._resourceNames.Shader.Name,
                {
                    Type: EResourceType.ShaderModule,
                    desc: { code: shaderCode }
                }
            );

            // 2. 创建 BindGroupLayout
            this._resourceManager.CreateResource(
                this._resourceNames.BindGroupLayout.Name,
                {
                    Type: EResourceType.BindGroupLayout,
                    desc: {
                        entries: [{
                            binding: 0,
                            visibility: GPUShaderStage.FRAGMENT,
                            texture: {
                                sampleType: 'depth'
                            }
                        }]
                    }
                }
            );

            // 3. 创建 PipelineLayout
            this._resourceManager.CreateResource(
                this._resourceNames.PipelineLayout.Name,
                {
                    Type: EResourceType.PipelineLayout,
                    desc: {
                        bindGroupLayouts: [
                            this._resourceManager.GetResource(this._resourceNames.BindGroupLayout.Name)
                        ]
                    }
                }
            );

            // 4. 创建渲染管线
            this._resourceManager.CreateResource(
                this._resourceNames.Pipeline.Name,
                {
                    Type: EResourceType.RenderPipeline,
                    desc: {
                        layout: this._resourceManager.GetResource(this._resourceNames.PipelineLayout.Name),
                        vertex: {
                            module: shader,
                            entryPoint: 'vsMain'
                        },
                        fragment: {
                            module: shader,
                            entryPoint: 'fsMain',
                            targets: [{
                                format: 'rgba8unorm'
                            }]
                        },
                        primitive: {
                            topology: 'triangle-list',
                            cullMode: 'none'
                        }
                    }
                }
            );

        } catch (error) {
            console.error('FCopyToCanvasPass initialization failed:', error);
            throw error;
        }
    }

    /**
     * 处理Canvas尺寸变化
     * @param {number} width 新的宽度
     * @param {number} height 新的高度
     * @param {GPUCanvasContext} context 新的WebGPU上下文
     */
    async OnCanvasResize(width, height, context) {
        this.#width = width;
        this.#height = height;
        this.#context = context;
    }

    /**
     * 设置源纹理
     * @param {string} textureName 要拷贝的源纹理名称
     */
    SetSourceTexture(textureName) {
        if (!textureName) {
            console.error('FCopyToCanvasPass: Invalid texture name');
            return;
        }

        this._resourceNames.Source.Name = textureName;
        const sourceTexture = this._resourceManager.GetResource(textureName);
        
        if (!sourceTexture) {
            console.error(`FCopyToCanvasPass: Source texture '${textureName}' not found`);
            return;
        }

        // 只有深度纹理需要创建 BindGroup
        if (sourceTexture.format !== 'rgba8unorm') {
            try {
                this.#createOrUpdateBindGroup(sourceTexture);
            } catch (error) {
                console.error('FCopyToCanvasPass: Error updating resources:', error);
            }
        }
    }

    #createOrUpdateBindGroup(sourceTexture) {
        if (this._resourceManager.HasResource(this._resourceNames.BindGroup.Name)) {
            this._resourceManager.DeleteResource(this._resourceNames.BindGroup.Name);
        }

        this._resourceManager.CreateResource(
            this._resourceNames.BindGroup.Name,
            {
                Type: EResourceType.BindGroup,
                desc: {
                    layout: this._resourceManager.GetResource(this._resourceNames.BindGroupLayout.Name),
                    entries: [{
                        binding: 0,
                        resource: sourceTexture.createView()
                    }]
                }
            }
        );
    }

    /**
     * 获取Pass的默认输出Texture资源名
     * @returns {string} 默认输出Texture资源名 'null'表示没有默认输出Texture
     */
    GetDefaultOutputTextureName() {
        return null;
    }
}

export default FCopyToCanvasPass; 