import FPass from './FPass.js';
import FResourceManager from '../../Core/Resource/FResourceManager.js';

class FCopyToCanvasPass extends FPass {
    #context;
    #width;
    #height;

    /**
     * @param {GPUCanvasContext} context WebGPU上下文
     * @param {GPUTexture} sourceTexture 源纹理
     */
    constructor(context, sourceTexture) {
        super('CopyToCanvasPass');
        this.#context = context;
        this.#width = context.canvas.width;
        this.#height = context.canvas.height;

        // 添加固定资源 - 源纹理
        this.AddInputResource('SourceTexture', {
            Description: '需要拷贝到Canvas的源纹理'
        });

        // 设置初始资源
        if (sourceTexture) {
            this.SetResource('SourceTexture', sourceTexture, 'Input');
        }
    }

    /**
     * 执行拷贝到Canvas的渲染Pass
     * @param {GPUCommandEncoder} commandEncoder 命令编码器
     */
    Execute(commandEncoder) {
        if (!this.ValidateResources()) {
            console.error('CopyToCanvasPass: Resources not ready');
            return;
        }

        const sourceTexture = this.GetResource('SourceTexture');
        if (!sourceTexture) {
            console.error('CopyToCanvasPass: Source texture not found');
            return;
        }

        // 直接执行纹理拷贝
        commandEncoder.copyTextureToTexture(
            {
                texture: sourceTexture
            },
            {
                texture: this.#context.getCurrentTexture()
            },
            {
                width: this.#width,
                height: this.#height,
                depthOrArrayLayers: 1
            }
        );
    }

    /**
     * 更新Canvas尺寸
     * @param {number} width 新的宽度
     * @param {number} height 新的高度
     * @param {GPUCanvasContext} context 新的WebGPU上下文
     */
    Resize(width, height, context) {
        this.#width = width;
        this.#height = height;
        this.#context = context;
    }

    /**
     * 设置源纹理
     * @param {string} textureName 要拷贝的源纹理名称
     */
    SetSourceTexture(textureName) {
        const resourceManager = FResourceManager.GetInstance();
        const texture = resourceManager.GetResource(textureName);
        if (!texture) {
            console.error(`CopyToCanvasPass: Texture "${textureName}" not found`);
            return;
        }
        this.SetResource('SourceTexture', texture, 'Input');
    }
}

export default FCopyToCanvasPass; 