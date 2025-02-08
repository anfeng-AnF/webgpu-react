import ShaderConverterBase from './ShaderConverterBase';
import ShaderIncluder from '../../../../../Core/Shader/ShaderIncluder';

/**
 * 颜色纹理转换器
 * 用于处理RGBA8和RGB10A2格式的转换
 */
class ColorConverter extends ShaderConverterBase {
    constructor(resourceManager, passName, format) {
        super(resourceManager, passName);
        this._format = format;
    }

    async _GetShaderCode() {
        return await ShaderIncluder.GetShaderCode('/Shader/PostProcess/ColorCopy.wgsl');
    }

    _GetPipelineDesc(shaderModule) {
        return {
            layout: 'auto',
            vertex: {
                module: shaderModule,
                entryPoint: 'VSMain'
            },
            fragment: {
                module: shaderModule,
                entryPoint: this._format === 'rgb10a2unorm' ? 'FSRGB10A2Main' : 'FSColorMain',
                targets: [{
                    format: navigator.gpu.getPreferredCanvasFormat()
                }]
            },
            primitive: {
                topology: 'triangle-strip',
                stripIndexFormat: 'uint32'
            }
        };
    }

    _GetBindGroupEntries(sourceTexture) {
        return [
            {
                binding: 0,
                resource: this._sampler
            },
            {
                binding: 1,
                resource: sourceTexture.createView({
                    format: this._format,
                    dimension: '2d',
                    aspect: 'all'
                })
            }
        ];
    }
}

export default ColorConverter; 