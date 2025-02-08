import BaseTextureConverter from './BaseTextureConverter';

/**
 * 着色器管线转换器基类
 * 用于需要使用着色器进行格式转换的情况
 */
class ShaderConverterBase extends BaseTextureConverter {
    constructor(resourceManager, passName) {
        super(resourceManager, passName);
        this._pipeline = null;
        this._bindGroup = null;
        this._sampler = null;
        this._sourceTextureName = null;
    }

    async Initialize(sourceTextureName) {
        this._sourceTextureName = sourceTextureName;
        await this._CreateSampler();
        await this._CreatePipeline();
        await this._CreateBindGroup(sourceTextureName);
    }

    async _CreateSampler() {
        const samplerDesc = this._GetSamplerDesc();
        this._sampler = await this._ResourceManager.CreateResource(
            this._PassName + 'CopySampler',
            {
                Type: 'Sampler',
                desc: samplerDesc
            }
        );
    }

    _GetSamplerDesc() {
        return {
            magFilter: 'linear',
            minFilter: 'linear',
            addressModeU: 'clamp-to-edge',
            addressModeV: 'clamp-to-edge',
            addressModeW: 'clamp-to-edge',
        };
    }

    async _CreatePipeline() {
        const shaderCode = await this._GetShaderCode();
        const shaderModule = await this._ResourceManager.CreateResource(
            this._PassName + 'ShaderModule',
            {
                Type: 'ShaderModule',
                desc: { code: shaderCode }
            }
        );

        this._pipeline = await this._ResourceManager.CreateResource(
            this._PassName + 'Pipeline',
            {
                Type: 'RenderPipeline',
                desc: this._GetPipelineDesc(shaderModule)
            }
        );
    }

    async _CreateBindGroup(sourceTextureName) {
        const sourceTexture = this._ResourceManager.GetResource(sourceTextureName);
        if (!sourceTexture) {
            throw new Error(`Source texture ${sourceTextureName} not found`);
        }

        this._bindGroup = await this._ResourceManager.CreateResource(
            this._PassName + 'BindGroup',
            {
                Type: 'BindGroup',
                desc: {
                    layout: this._pipeline.getBindGroupLayout(0),
                    entries: this._GetBindGroupEntries(sourceTexture)
                }
            }
        );
    }

    Convert(commandEncoder, sourceTexture, targetTexture) {
        const passEncoder = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: targetTexture.createView(),
                clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store',
            }]
        });

        passEncoder.setPipeline(this._pipeline);
        passEncoder.setBindGroup(0, this._bindGroup);
        passEncoder.draw(4, 1, 0, 0);
        passEncoder.end();
    }

    async OnResize(width, height) {
        if (this._sourceTextureName) {
            await this._CreateBindGroup(this._sourceTextureName);
        }
    }

    async Destroy() {
        this._ResourceManager.DeleteResource(this._PassName + 'Pipeline');
        this._ResourceManager.DeleteResource(this._PassName + 'BindGroup');
        this._ResourceManager.DeleteResource(this._PassName + 'CopySampler');
    }

    // 子类需要实现的方法
    async _GetShaderCode() {
        throw new Error('_GetShaderCode must be implemented');
    }

    _GetPipelineDesc(shaderModule) {
        throw new Error('_GetPipelineDesc must be implemented');
    }

    _GetBindGroupEntries(sourceTexture) {
        throw new Error('_GetBindGroupEntries must be implemented');
    }
}

export default ShaderConverterBase; 