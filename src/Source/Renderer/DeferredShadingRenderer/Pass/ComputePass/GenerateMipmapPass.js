import FPass from '../Pass';
import ShaderIncluder from '../../../../Core/Shader/ShaderIncluder';

class GenerateMipmapPass extends FPass {
    constructor() {
        super();
        this._Name = 'GenerateMipmapPass';
        this.sourceTexture = null;
        this.mipLevels = [];
    }

    /**
     * 设置源纹理和需要生成的mip级别
     * @param {GPUTexture} texture 源纹理
     */
    setSourceTexture(texture) {
        this.sourceTexture = texture;
        const width = texture.width;
        const height = texture.height;
        const mipLevelCount = Math.floor(Math.log2(Math.max(width, height))) + 1;

        // 为每个mip级别创建一个存储纹理视图
        this.mipLevels = [];
        for (let i = 1; i < mipLevelCount; i++) {
            const mipView = texture.createView({
                format: 'rgba32float',
                dimension: '2d',
                baseMipLevel: i,
                mipLevelCount: 1,
            });
            this.mipLevels.push(mipView);
        }
    }

    async Initialize() {
        // 加载计算着色器
        this.shaderCode = `
            @group(0) @binding(0) var sourceTex: texture_2d<f32>;
            @group(0) @binding(1) var outputTex: texture_storage_2d<rgba32float, write>;

            @compute @workgroup_size(8, 8, 1)
            fn CSMain(@builtin(global_invocation_id) global_id: vec3<u32>) {
                let outputSize = textureDimensions(outputTex);
                let coord = vec2<u32>(global_id.xy);
                
                // 如果超出输出纹理范围则返回
                if (coord.x >= outputSize.x || coord.y >= outputSize.y) {
                    return;
                }

                // 计算源纹理中对应的采样坐标
                let sourceSize = textureDimensions(sourceTex);
                let sourceCoord = vec2<i32>(coord * 2u);
                
                // 采样四个相邻像素并平均
                let c00 = textureLoad(sourceTex, sourceCoord, 0);
                let c10 = textureLoad(sourceTex, sourceCoord + vec2<i32>(1, 0), 0);
                let c01 = textureLoad(sourceTex, sourceCoord + vec2<i32>(0, 1), 0);
                let c11 = textureLoad(sourceTex, sourceCoord + vec2<i32>(1, 1), 0);
                
                let color = (c00 + c10 + c01 + c11) * 0.25;
                textureStore(outputTex, vec2<i32>(coord), color);
            }
        `;

        this.shaderModule = await this._ResourceManager.CreateResource(
            'GenerateMipmapShaderModule',
            {
                Type: 'ShaderModule',
                desc: { code: this.shaderCode }
            }
        );

        // 创建BindGroupLayout
        this.bindGroupLayout = await this._ResourceManager.CreateResource(
            'GenerateMipmapBindGroupLayout',
            {
                Type: 'BindGroupLayout',
                desc: {
                    entries: [
                        {
                            binding: 0,
                            visibility: GPUShaderStage.COMPUTE,
                            texture: {
                                sampleType: 'unfilterable-float',
                                viewDimension: '2d'
                            }
                        },
                        {
                            binding: 1,
                            visibility: GPUShaderStage.COMPUTE,
                            storageTexture: {
                                access: 'write-only',
                                format: 'rgba32float',
                                viewDimension: '2d'
                            }
                        }
                    ]
                }
            }
        );

        // 创建PipelineLayout
        this.pipelineLayout = await this._ResourceManager.CreateResource(
            'GenerateMipmapPipelineLayout',
            {
                Type: 'PipelineLayout',
                desc: {
                    bindGroupLayouts: [this.bindGroupLayout]
                }
            }
        );

        // 创建ComputePipeline
        this.pipeline = await this._ResourceManager.CreateResource(
            'GenerateMipmapPipeline',
            {
                Type: 'ComputePipeline',
                desc: {
                    layout: this.pipelineLayout,
                    compute: {
                        module: this.shaderModule,
                        entryPoint: 'CSMain'
                    }
                }
            }
        );
    }

    async Render(DeltaTime, Scene, CommandEncoder) {
        if (!this.sourceTexture || this.mipLevels.length === 0) return;

        const computePass = CommandEncoder.beginComputePass();
        computePass.setPipeline(this.pipeline);

        // 为每个mip级别生成纹理
        for (let i = 0; i < this.mipLevels.length; i++) {
            const sourceView = this.sourceTexture.createView({
                format: 'rgba32float',
                dimension: '2d',
                baseMipLevel: i,
                mipLevelCount: 1
            });

            const bindGroup = await this._ResourceManager.CreateResource(
                `GenerateMipmapBindGroup_${i}`,
                {
                    Type: 'BindGroup',
                    desc: {
                        layout: this.bindGroupLayout,
                        entries: [
                            {
                                binding: 0,
                                resource: sourceView
                            },
                            {
                                binding: 1,
                                resource: this.mipLevels[i]
                            }
                        ]
                    }
                }
            );

            computePass.setBindGroup(0, bindGroup);

            // 计算当前mip级别的尺寸
            const width = Math.max(1, this.sourceTexture.width >> (i + 1));
            const height = Math.max(1, this.sourceTexture.height >> (i + 1));
            const workgroupsX = Math.ceil(width / 8);
            const workgroupsY = Math.ceil(height / 8);

            computePass.dispatchWorkgroups(workgroupsX, workgroupsY, 1);
        }

        computePass.end();
    }
}

export default GenerateMipmapPass; 