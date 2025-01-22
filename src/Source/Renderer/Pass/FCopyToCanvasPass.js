import FPass, { EPassDependencyType } from '../../Core/Resource/FPass.js';

class FCopyToCanvasPass extends FPass {
    #Context;
    #SourceTexture;
    #Width;
    #Height;
    /**
     * @param {string} InName Pass名称
     * @param {GPUCanvasContext} ConfiguredContext 配置好的WebGPU上下文
     * @param {string} InSourceTextureName 源纹理名称
     * @param {number} InWidth Canvas宽度
     * @param {number} InHeight Canvas高度
     */
    constructor(InName, ConfiguredContext, InSourceTextureName, InWidth, InHeight) {
        super(InName);
        this.#Context = ConfiguredContext;
        this.#SourceTexture = InSourceTextureName;
        this.#Width = InWidth;
        this.#Height = InHeight;


        // 声明输入资源依赖
        this.AddDependency('SourceTexture', EPassDependencyType.Input, {
            Description: '需要拷贝到Canvas的源纹理'
        });
    }

    /**
     * 执行拷贝到Canvas的渲染Pass
     * @param {GPUCommandEncoder} InCommandEncoder 命令编码器
     */
    Execute(InCommandEncoder) {
        if (!this.ValidateDependencies()) {
            return;
        }

        const SourceTexture = this.GetResource('SourceTexture');
        if (!SourceTexture) {
            console.error('Source texture not found');
            return;
        }

        // 直接执行纹理拷贝
        InCommandEncoder.copyTextureToTexture(
            {
                texture: SourceTexture
            },
            {
                texture: this.#Context.getCurrentTexture()
            },
            {
                width: this.#Width,
                height: this.#Height,
                depthOrArrayLayers: 1
            }
        );
    }

    /**
     * 更新Canvas尺寸
     * @param {number} InWidth 宽度
     * @param {number} InHeight 高度
     * @param {GPUCanvasContext} ConfiguredContext 配置好的WebGPU上下文
     */
    Resize(InWidth, InHeight, ConfiguredContext) {
        this.#Width = InWidth;
        this.#Height = InHeight;
        this.#Context = ConfiguredContext;
    }

    /**
     * 设置源纹理
     * @param {string} InSourceTexture 要拷贝的源纹理name
     */
    SetSourceTexture(InSourceTexture) {
        this.RemoveDependency('SourceTexture');

        this.#SourceTexture = InSourceTexture;
        this.AddDependency(InSourceTexture, EPassDependencyType.Input, {
            Description: '需要拷贝到Canvas的源纹理'
        });
    }
}

export default FCopyToCanvasPass; 