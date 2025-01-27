import BindGroup from 'three/src/renderers/common/BindGroup.js';
import FPass from '../Pass';
import ShaderIncluder from '../../../../Core/Shader/ShaderIncluder';
import FResourceManager from '../../../../Core/Resource/FResourceManager';
/**
 * 复制Texture到画布pass
 */
class FCopyToCanvasPass extends FPass {
    /**
     *
     * @type {string}
     * @private
     */
    _SourceTexture = null;

    /**
     *  @type {HTMLCanvasElement}
     *  @private
     */
    _CanvasTexture = null;

    /**
     *
     * @type {boolean}
     * @private
     */
    _bCopyDirect = false;

    /**
     * @param {string} ResourceTextureName
     * @param {HTMLCanvasElement}TargetCanvas
     */
    constructor(ResourceTextureName, TargetCanvas) {
        super('CopyToCanvasPass');
        if (!ResourceTextureName || !TargetCanvas) {
            throw new Error('ResourceTextureName and TargetCanvas are required');
        }
        this._SourceTexture = ResourceTextureName;
        this._CanvasTexture = TargetCanvas;
    }

    /**
     * 初始化资源名称
     */
    async InitResourceName() {
        this._Resources = {
            PassName: `${this._Name}`,
            Resources: {
                Dependence: {
                    Texture: [`${this._SourceTexture}`],
                },
                Managed: {
                    Texture: [`${this._Name}CopyTempTexture`],
                    Pipeline: [`${this._Name}CopyToCanvasPipeline`],
                    BindGroup: [`${this._Name}CopyToCanvasBindGroup`],
                    Sampler: [`${this._Name}CopySampler`],
                },
                //这个pass直接输出到Canvas
                Output: {},
            },
        };
    }

    /**
     * 初始化
     */
    async Initialize() {
        if (!this._ResourceManager) {
            this._ResourceManager = FResourceManager.GetInstance();
        }

        // 获取设备
        const device = await this._ResourceManager.GetDevice();

        // 配置 Canvas
        const context = this._CanvasTexture.getContext('webgpu');
        context.configure({
            device: device,
            format: navigator.gpu.getPreferredCanvasFormat(),
            alphaMode: 'premultiplied',
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING 
            | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC,
        });

        const sourceTexture = this._ResourceManager.GetResource(this._SourceTexture);
        if (!sourceTexture) {
            throw new Error(`ResourceTexture ${this._SourceTexture} not found`);
        }

        // 根据源纹理格式决定复制方式
        switch (sourceTexture.format) {
            case navigator.gpu.getPreferredCanvasFormat():
                this._bCopyDirect = true;
                await this._InitializeDirectCopy();
                break;
            case 'depth24plus':
                this._bCopyDirect = false;
                await this._InitializeDepthCopy();
                break;
            default:
                throw new Error(`Unsupported texture format: ${sourceTexture.format}`);
        }

        this._bInitialized = true;
    }

    async _InitializeDirectCopy() {
        const sourceTexture = this._ResourceManager.GetResource(this._SourceTexture);
        
        // 检查是否支持直接复制
        if (sourceTexture.usage & GPUTextureUsage.COPY_SRC) {
            this._copyMode = 'direct';
        } else {
            // 如果不支持直接复制
            throw new Error('Direct copy is not supported for this texture without COPY_SRC usage');
        }
    }

    async _InitializeDepthCopy() {
        // 创建采样器，使用非过滤模式
        const sampler = this._ResourceManager.CreateResource(
            this._Name + 'CopySampler',
            {
                Type: 'Sampler',
                desc: {
                    magFilter: 'nearest',
                    minFilter: 'nearest',
                    mipmapFilter: 'nearest',
                    addressModeU: 'clamp-to-edge',
                    addressModeV: 'clamp-to-edge',
                }
            }
        );

        // 创建着色器模块
        const shaderModule = this._ResourceManager.CreateResource(
            this._Name + 'ShaderModule',
            {
                Type: 'ShaderModule',
                desc: {
                    code: `
                        struct VSOutput {
                            @builtin(position) position: vec4<f32>,
                            @location(0) texCoord: vec2<f32>
                        }

                        @vertex
                        fn VSMain(@builtin(vertex_index) VertexIndex : u32) -> VSOutput {
                            var pos = array<vec2<f32>, 4>(
                                vec2<f32>(-1.0, -1.0),
                                vec2<f32>( 1.0, -1.0),
                                vec2<f32>(-1.0,  1.0),
                                vec2<f32>( 1.0,  1.0)
                            );
                            var texCoord = array<vec2<f32>, 4>(
                                vec2<f32>(0.0, 1.0),
                                vec2<f32>(1.0, 1.0),
                                vec2<f32>(0.0, 0.0),
                                vec2<f32>(1.0, 0.0)
                            );
                            
                            var output: VSOutput;
                            output.position = vec4<f32>(pos[VertexIndex], 0.0, 1.0);
                            output.texCoord = texCoord[VertexIndex];
                            return output;
                        }

                        @group(0) @binding(0) var depthSampler: sampler;
                        @group(0) @binding(1) var depthTexture: texture_depth_2d;

                        @fragment
                        fn FSDepthMain(@location(0) texCoord: vec2<f32>) -> @location(0) vec4<f32> {
                            let depth = textureSample(depthTexture, depthSampler, texCoord);
                            
                            // 调整深度值的可视化
                            // 将 [0,1] 范围的深度值映射到更容易看到的范围
                            let adjustedDepth = 1.0 - pow(depth, 32.0);
                            
                            return vec4<f32>(adjustedDepth, adjustedDepth, adjustedDepth, 1.0);
                        }
                    `
                }
            }
        );

        // 创建渲染管线
        this._pipeline = this._ResourceManager.CreateResource(
            this._Name + 'CopyToCanvasPipeline',
            {
                Type: 'RenderPipeline',
                desc: {
                    layout: 'auto',
                    vertex: {
                        module: shaderModule,
                        entryPoint: 'VSMain'
                    },
                    fragment: {
                        module: shaderModule,
                        entryPoint: 'FSDepthMain',
                        targets: [{
                            format: navigator.gpu.getPreferredCanvasFormat()
                        }]
                    },
                    primitive: {
                        topology: 'triangle-strip',
                        stripIndexFormat: 'uint32'
                    }
                }
            }
        );

        // 修改 BindGroup 创建
        this._bindGroup = this._ResourceManager.CreateResource(
            this._Name + 'CopyToCanvasBindGroup',
            {
                Type: 'BindGroup',
                desc: {
                    layout: this._pipeline.getBindGroupLayout(0),
                    entries: [
                        {
                            binding: 0,
                            resource: sampler
                        },
                        {
                            binding: 1,
                            resource: this._ResourceManager.GetResource(this._SourceTexture).createView()
                        }
                    ]
                }
            }
        );
    }

    /**
     * 销毁
     */
    async Destroy() {
        // 取消 Canvas 配置
        const context = this._CanvasTexture.getContext('webgpu');
        context.unconfigure();

        // 清理资源
        if (this._pipeline) {
            this._ResourceManager.DestroyResource(this._Name + 'CopyToCanvasPipeline');
            this._pipeline = null;
        }
        if (this._bindGroup) {
            this._ResourceManager.DestroyResource(this._Name + 'CopyToCanvasBindGroup');
            this._bindGroup = null;
        }
        this._ResourceManager.DestroyResource(this._Name + 'CopySampler');
    }

    /**
     * 渲染
     * @param {number} DeltaTime 时间差
     * @param {GPUCommandEncoder} CommandEncoder 命令编码器
     */
    Render(DeltaTime, CommandEncoder) {
        const sourceTexture = this._ResourceManager.GetResource(this._SourceTexture);
        const context = this._CanvasTexture.getContext('webgpu');
        const canvasTexture = context.getCurrentTexture();

        if (this._copyMode === 'direct') {
            // 直接复制
            CommandEncoder.copyTextureToTexture(
                { texture: sourceTexture },
                { texture: canvasTexture },
                [canvasTexture.width, canvasTexture.height, 1]
            );
        } else {
            // 使用渲染管线
            const renderPassDescriptor = {
                colorAttachments: [{
                    view: canvasTexture.createView(),
                    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                    loadOp: 'clear',
                    storeOp: 'store',
                }]
            };

            const passEncoder = CommandEncoder.beginRenderPass(renderPassDescriptor);
            passEncoder.setPipeline(this._pipeline);
            passEncoder.setBindGroup(0, this._bindGroup);
            passEncoder.draw(4, 1, 0, 0);
            passEncoder.end();
        }
    }

    /**
     * 渲染目标大小改变
     * @param {number} Width 宽度
     * @param {number} Height 高度
     */
    async OnRenderTargetResize(Width, Height) {
        // 重新配置 Canvas
        const context = this._CanvasTexture.getContext('webgpu');
        const device = await this._ResourceManager.GetDevice();
        
        context.configure({
            device: device,
            format: navigator.gpu.getPreferredCanvasFormat(),
            alphaMode: 'premultiplied',
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING 
            | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC,
        });

        // 如果需要，更新资源大小
        if (this._copyMode === 'pipeline') {
            // 重新创建BindGroup
            this._bindGroup = this._ResourceManager.CreateResource(
                this._Name + 'CopyToCanvasBindGroup',
                {
                    Type: 'BindGroup',
                    desc: {
                        layout: this._pipeline.getBindGroupLayout(0),
                        entries: [
                            {
                                binding: 0,
                                resource: this._ResourceManager.GetResource(this._Name + 'CopySampler')
                            },
                            {
                                binding: 1,
                                resource: this._ResourceManager.GetResource(this._SourceTexture).createView()
                            }
                        ]
                    }
                }
            );
        }
    }

    /**
     * 获取名称
     * @returns {string}
     */
    GetName() {
        return this._Name;
    }
}

export default FCopyToCanvasPass;
