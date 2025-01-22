import FResourceManager from '../../../Core/Resource/FResourceManager.js';
import EarlyZPassShaderURL from '../../../Shader/DeferredRendering/Default/EarlyZPass.wgsl?url';

class ResourceConfig {
    static #ResourceManager = FResourceManager.GetInstance();

    static GetBindGroupLayout(groupName) {
        const configs = {
            Scene: {
                entries: [{
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: { type: 'uniform' }
                }]
            },
            MeshTransform: {
                entries: [{
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: { 
                        type: 'read-only-storage'
                    }
                }]
            },
            MeshIndex: {
                entries: [{
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: {
                        type: 'uniform',
                        hasDynamicOffset: true,
                        minBindingSize: 4
                    }
                }]
            },
            Bone: {
                entries: [{
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: { 
                        type: 'read-only-storage'
                    }
                }]
            }
        };
        return configs[groupName];
    }

    static GetStaticMeshLayout() {
        return {
            arrayStride: 60, // 3*4 + 3*4 + 3*4 + 2*4 + 2*4 + 2*4 + 2*4 = 60 bytes
            attributes: [
                {
                    shaderLocation: 0,
                    offset: 0,
                    format: 'float32x3'  // Position
                },
                {
                    shaderLocation: 1,
                    offset: 12,
                    format: 'float32x3'  // Normal
                },
                {
                    shaderLocation: 2,
                    offset: 24,
                    format: 'float32x3'  // Tangent
                },
                {
                    shaderLocation: 3,
                    offset: 36,
                    format: 'float32x2'  // UV0
                },
                {
                    shaderLocation: 4,
                    offset: 44,
                    format: 'float32x2'  // UV1
                },
                {
                    shaderLocation: 5,
                    offset: 48,
                    format: 'float32x2'  // UV2
                },
                {
                    shaderLocation: 6,
                    offset: 52,
                    format: 'float32x2'  // UV3
                }
            ]
        };
    }

    static GetSkeletalMeshLayout() {
        return {
            arrayStride: 80, // Static(60) + BoneIndices(4) + BoneWeights(16) = 80 bytes
            attributes: [
                ...this.GetStaticMeshLayout().attributes,
                {
                    shaderLocation: 7,
                    offset: 60,
                    format: 'uint8x4',  // BoneIndices
                    normalized: false
                },
                {
                    shaderLocation: 8,
                    offset: 64,
                    format: 'float32x4',  // BoneWeights，改为浮点数格式
                }
            ]
        };
    }
}

class EarlyZPipelineDesc {
    static async GetShaderCode() {
        const response = await fetch(EarlyZPassShaderURL);
        return await response.text();
    }

    static GetResourceNames() {
        return {
            Shader: 'EarlyZPassShader',
            Pipelines: {
                static: 'StaticMeshEarlyZPipeline',
                skeletal: 'SkeletalMeshEarlyZPipeline',
                instanced: 'InstancedMeshEarlyZPipeline'
            },
            BindGroupLayouts: {
                Scene: 'SceneBindGroupLayout',
                MeshTransform: 'MeshBindGroupLayout',
                MeshIndex: 'MeshIndexBindGroupLayout',
                Bone: 'BoneBindGroupLayout'
            },
            PipelineLayout: 'EarlyZPipelineLayout'
        };
    }

    static async GetShaderDesc() {
        return {
            code: await this.GetShaderCode(),
            entryPoints: {
                vertex: {
                    static: 'vsStaticMesh',
                    skeletal: 'vsSkeletalMesh',
                    instanced: 'vsInstancedMesh'
                },
                fragment: 'fsMain'
            }
        };
    }

    static GetPipelineLayoutDesc() {
        const bindGroupOrder = ['Scene', 'MeshTransform', 'MeshIndex', 'Bone'];
        return bindGroupOrder.map(name => ResourceConfig.GetBindGroupLayout(name));
    }

    static async GetPipelineDesc(shaderModule, meshType, pipelineLayout) {
        const shaderDesc = await this.GetShaderDesc();
        const baseConfig = {
            layout: pipelineLayout,
            vertex: {
                module: shaderModule,
                entryPoint: shaderDesc.entryPoints.vertex[meshType],
                buffers: [
                    meshType === 'skeletal' 
                        ? ResourceConfig.GetSkeletalMeshLayout()
                        : ResourceConfig.GetStaticMeshLayout()
                ]
            },
            fragment: {
                module: shaderModule,
                entryPoint: shaderDesc.entryPoints.fragment,
                targets: [
                    {
                        format: 'rgba8unorm',
                        writeMask: 0, // 禁止颜色写入
                    }
                ]
            },
            primitive: {
                topology: 'triangle-list',
                cullMode: 'back'
            },
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: 'less',
                format: 'depth24plus'
            }
        };

        return baseConfig;
    }
}

export { ResourceConfig, EarlyZPipelineDesc };
