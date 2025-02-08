import FPass from '../Pass';
import FResourceManager from '../../../../Core/Resource/FResourceManager';
import ConverterFactory from './Converters/ConverterFactory';

/**
 * 复制Texture到画布的渲染通道类
 * 使用策略模式处理不同格式的纹理转换
 */
class FCopyToCanvasPass extends FPass {
    /**
     * @type {string}
     * @private
     */
    _SourceTexture = null;

    /**
     * @type {HTMLCanvasElement}
     * @private
     */
    _CanvasTexture = null;

    /**
     * @type {BaseTextureConverter}
     * @private
     */
    _Converter = null;

    /**
     * 创建一个复制到画布的渲染通道
     * @param {string} ResourceTextureName - 源纹理的资源名称
     * @param {HTMLCanvasElement} TargetCanvas - 目标Canvas元素
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
                    Pipeline: [`${this._Name}CopyToCanvasPipeline`],
                    BindGroup: [`${this._Name}CopyToCanvasBindGroup`],
                    Sampler: [`${this._Name}CopySampler`],
                },
                Output: {},
            },
        };
    }

    /**
     * 初始化渲染通道
     */
    async Initialize() {
        if (!this._ResourceManager) {
            this._ResourceManager = FResourceManager.GetInstance();
        }

        // 配置 Canvas
        const device = await this._ResourceManager.GetDevice();
        const context = this._CanvasTexture.getContext('webgpu');
        context.configure({
            device: device,
            format: navigator.gpu.getPreferredCanvasFormat(),
            alphaMode: 'premultiplied',
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING 
            | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC,
        });

        // 获取源纹理并检查
        const sourceTexture = this._ResourceManager.GetResource(this._SourceTexture);
        if (!sourceTexture) {
            throw new Error(`ResourceTexture ${this._SourceTexture} not found`);
        }

        // 创建对应的转换器
        this._Converter = ConverterFactory.CreateConverter(
            sourceTexture.format,
            this._ResourceManager,
            this._Name
        );

        // 初始化转换器
        await this._Converter.Initialize(this._SourceTexture);

        this._bInitialized = true;
    }

    /**
     * 处理渲染目标大小改变
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

        // 通知转换器大小改变
        if (this._Converter) {
            await this._Converter.OnResize(Width, Height);
        }
    }

    /**
     * 执行渲染
     */
    Render(DeltaTime, CommandEncoder) {
        if (!this._bInitialized || !this._Converter) return;

        const sourceTexture = this._ResourceManager.GetResource(this._SourceTexture);
        const context = this._CanvasTexture.getContext('webgpu');
        const canvasTexture = context.getCurrentTexture();

        this._Converter.Convert(CommandEncoder, sourceTexture, canvasTexture);
    }

    /**
     * 销毁渲染通道
     */
    async Destroy() {
        // 取消 Canvas 配置
        const context = this._CanvasTexture.getContext('webgpu');
        context.unconfigure();

        // 销毁转换器
        if (this._Converter) {
            await this._Converter.Destroy();
            this._Converter = null;
        }
    }

    /**
     * 获取渲染通道名称
     */
    GetName() {
        return this._Name;
    }
}

export default FCopyToCanvasPass;
