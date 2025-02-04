import BindGroup from 'three/src/renderers/common/BindGroup.js';
import FPass from '../Pass';
import ShaderIncluder from '../../../../Core/Shader/ShaderIncluder';
import FResourceManager from '../../../../Core/Resource/FResourceManager';
/**
 * 复制Texture到画布的渲染通道类
 * 工作流程:
 * 1. 构造时指定源纹理和目标Canvas
 * 2. 初始化时根据源纹理格式选择复制模式:
 *    - 如果格式匹配Canvas，使用直接复制模式
 *    - 如果是深度纹理，使用着色器管线模式
 * 3. 渲染时根据不同模式执行复制:
 *    - 直接复制模式: 使用copyTextureToTexture
 *    - 管线模式: 使用渲染管线和着色器转换
 * 
 * @class FCopyToCanvasPass
 * @extends FPass
 */
class FCopyToCanvasPass extends FPass {
    /**
     * 源纹理的资源名称
     * 用于从资源管理器获取源纹理
     * @type {string}
     * @private
     */
    _SourceTexture = null;

    /**
     * 目标Canvas元素
     * 作为最终渲染输出目标
     * @type {HTMLCanvasElement}
     * @private
     */
    _CanvasTexture = null;

    /**
     * 是否可以直接复制
     * true: 使用copyTextureToTexture直接复制
     * false: 需要使用着色器管线进行格式转换
     * @type {boolean}
     * @private
     */
    _bCopyDirect = false;

    /**
     * 创建一个复制到画布的渲染通道
     * 初始化步骤:
     * 1. 调用父类构造函数
     * 2. 验证参数
     * 3. 保存源纹理名称和目标Canvas
     * 
     * @constructor
     * @param {string} ResourceTextureName - 源纹理的资源名称
     * @param {HTMLCanvasElement} TargetCanvas - 目标Canvas元素
     * @throws {Error} 如果ResourceTextureName或TargetCanvas为空
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
     * 配置该Pass需要的资源:
     * 1. 依赖资源: 源纹理
     * 2. 管理资源: 临时纹理、渲染管线、绑定组、采样器
     * 
     * @async
     * @returns {Promise<void>}
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
     * 初始化渲染通道 （当前仅支持Depth24Plus的纹理，和gpu的preferredCanvasFormat）
     * 步骤:
     * 1. 获取资源管理器和设备
     * 2. 配置Canvas上下文
     * 3. 获取源纹理
     * 4. 根据源纹理格式选择初始化模式:
     *    - 标准格式: 初始化直接复制
     *    - 深度格式: 初始化深度复制
     * 
     * @async
     * @returns {Promise<void>}
     * @throws {Error} 如果ResourceTexture未找到或纹理格式不支持
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

        // 为深度纹理创建特殊的采样器
        if (this._SourceTexture.includes('Depth')) {
            await this._ResourceManager.CreateResource(this._Name + 'CopySampler', {
                Type: 'Sampler',
                desc: {
                    type: 'non-filtering',  // 使用非过滤采样器
                    addressModeU: 'clamp-to-edge',
                    addressModeV: 'clamp-to-edge',
                    addressModeW: 'clamp-to-edge',
                }
            });
        } else {
            // 普通纹理使用默认采样器
            await this._ResourceManager.CreateResource(this._Name + 'CopySampler', {
                Type: 'Sampler',
                desc: {
                    magFilter: 'linear',
                    minFilter: 'linear',
                    addressModeU: 'clamp-to-edge',
                    addressModeV: 'clamp-to-edge',
                    addressModeW: 'clamp-to-edge',
                }
            });
        }

        this._bInitialized = true;
    }

    /**
     * 初始化直接复制模式
     * 检查源纹理是否支持直接复制:
     * - 必须具有COPY_SRC使用权限
     * - 设置copyMode为'direct'
     * 
     * @async
     * @private
     * @returns {Promise<void>}
     * @throws {Error} 如果纹理不支持直接复制
     */
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

    /**
     * 初始化深度复制模式
     * 步骤:
     * 1. 创建nearest采样器
     * 2. 加载深度转换着色器
     * 3. 创建着色器模块
     * 4. 创建渲染管线
     * 5. 创建绑定组
     * 6. 设置copyMode为'pipeline'
     * 
     * @async
     * @private
     * @returns {Promise<void>}
     */
    async _InitializeDepthCopy() {
        // 创建采样器，使用非过滤模式
        const sampler = await this._ResourceManager.CreateResource(
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


        const shaderCode = await ShaderIncluder.GetShaderCode('/Shader/PostProcess/Depth24ToColor.wgsl');
        // 创建着色器模块
        const shaderModule = await this._ResourceManager.CreateResource(
            this._Name + 'ShaderModule',
            {
                Type: 'ShaderModule',
                desc: {
                    code: shaderCode
                }
            }
        );

        // 创建渲染管线
        const pipeline = await this._ResourceManager.CreateResource(
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
        const bindGroup = await this._ResourceManager.CreateResource(
            this._Name + 'CopyToCanvasBindGroup',
            {
                Type: 'BindGroup',
                desc: {
                    layout: pipeline.getBindGroupLayout(0),
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

        // 存储引用
        this._copyMode = 'pipeline';
        this._pipelineName = this._Name + 'CopyToCanvasPipeline';
        this._bindGroupName = this._Name + 'CopyToCanvasBindGroup';
    }

    /**
     * 销毁渲染通道及其资源
     * 清理步骤:
     * 1. 取消Canvas配置
     * 2. 删除管线资源
     * 3. 删除绑定组资源
     * 4. 删除采样器资源
     * 
     * @async
     * @returns {Promise<void>}
     */
    async Destroy() {
        // 取消 Canvas 配置
        const context = this._CanvasTexture.getContext('webgpu');
        context.unconfigure();

        // 清理资源
        if (this._pipelineName) {
            this._ResourceManager.DeleteResource(this._pipelineName);
        }
        if (this._bindGroupName) {
            this._ResourceManager.DeleteResource(this._bindGroupName);
        }
        this._ResourceManager.DeleteResource(this._Name + 'CopySampler');
    }

    /**
     * 执行渲染
     * 根据copyMode执行不同的复制操作:
     * - direct模式: 使用copyTextureToTexture直接复制
     * - pipeline模式: 使用渲染管线和着色器转换后复制
     * 
     * @param {number} DeltaTime - 与上一帧的时间差（秒）
     * @param {GPUCommandEncoder} CommandEncoder - WebGPU命令编码器
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
        } else if (this._copyMode === 'pipeline') {
            // 从资源管理器获取pipeline和bindGroup
            const pipeline = this._ResourceManager.GetResource(this._pipelineName);
            const bindGroup = this._ResourceManager.GetResource(this._bindGroupName);

            if (!pipeline || !bindGroup) {
                console.error('Pipeline or BindGroup not found');
                return;
            }

            const renderPassDescriptor = {
                colorAttachments: [{
                    view: canvasTexture.createView(),
                    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                    loadOp: 'clear',
                    storeOp: 'store',
                }]
            };

            const passEncoder = CommandEncoder.beginRenderPass(renderPassDescriptor);
            passEncoder.setPipeline(pipeline);
            passEncoder.setBindGroup(0, bindGroup);
            passEncoder.draw(4, 1, 0, 0);
            passEncoder.end();
        }
    }

    /**
     * 处理渲染目标大小改变事件
     * 步骤:
     * 1. 重新配置Canvas
     * 2. 对于pipeline模式:
     *    - 获取管线
     *    - 重新创建绑定组以适应新尺寸
     * 
     * @async
     * @param {number} Width - 新的宽度
     * @param {number} Height - 新的高度
     * @returns {Promise<void>}
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
            const pipeline = this._ResourceManager.GetResource(this._pipelineName);
            if (!pipeline) {
                console.error('Pipeline not found during resize');
                return;
            }

            // 重新创建BindGroup
            await this._ResourceManager.CreateResource(
                this._bindGroupName,
                {
                    Type: 'BindGroup',
                    desc: {
                        layout: pipeline.getBindGroupLayout(0),
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
     * 获取渲染通道名称
     * @returns {string} 渲染通道名称
     */
    GetName() {
        return this._Name;
    }
}

export default FCopyToCanvasPass;
