import ShaderConverterBase from './ShaderConverterBase';
import ShaderIncluder from '../../../../../Core/Shader/ShaderIncluder';

/**
 * 深度纹理转换器
 * 用于将深度纹理转换为可视化的颜色纹理
 */
class DepthConverter extends ShaderConverterBase {
    constructor(resourceManager, passName, format) {
        super(resourceManager, passName);
        this._format = format;
    }

    _GetSamplerDesc() {
        return {
            type: 'non-filtering',
            addressModeU: 'clamp-to-edge',
            addressModeV: 'clamp-to-edge',
            addressModeW: 'clamp-to-edge',
        };
    }

    async _GetShaderCode() {
        switch (this._format) {
            case 'depth32float':
                return await ShaderIncluder.GetShaderCode('/Shader/PostProcess/Depth32ToColor.wgsl');
            default:
                return await ShaderIncluder.GetShaderCode('/Shader/PostProcess/Depth24ToColor.wgsl');
        }
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
                entryPoint: 'FSDepthMain',
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
                    aspect: 'depth-only'
                })
            }
        ];
    }
}

export default DepthConverter; 