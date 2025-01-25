import FResourceManager from '../../../Core/Resource/FResourceManager.js';

/*
 * 资源名称包含dynamic的表示是动态创建的
 * 渲染管线 xxx pass:
 *      内容：
 *          默认管线配置
 *          默认BindGroup配置
 *          默认PipelineLayout配置
 *          默认Shader
 *          默认Pipeline配置
 *          默认使用的资源名称
 * 基本资源 ResourceConfig：
 *      内容：
 *          默认顶点布局   - 静态网格、骨骼网格、实例化网格
 *          默认场景缓冲区名称配置 - 矩阵、相机、组合属性
 *          默认基础BindGroup布局配置 - 场景、变换、材质、骨骼
 *          默认基础渲染状态配置 - 默认、透明
 *          默认资源desc - texture、buffer、uniform、storage
 */
/**
 * 基础资源配置类
 */
class ResourceConfig {
    static #ResourceManager = FResourceManager.GetInstance();

    // 缓存配置对象
    static #staticMeshLayout = null;
    static #skeletalMeshLayout = null;
    static #sceneBuffer = null;
    static #baseBindGroupLayouts = null;
    static #baseRenderStates = null;
    static #baseResourceDesc = null;
    static #baseResourceNames = null;
    /**
     * 获取静态网格顶点布局
     */
    static GetStaticMeshLayout() {
        if (!this.#staticMeshLayout) {
            this.#staticMeshLayout = {
                arrayStride: 68, // Position(12) + Normal(12) + Tangent(12) + UV0(8) + UV1(8) + UV2(8) + UV3(8)
                attributes: [
                    {
                        shaderLocation: 0,
                        offset: 0,
                        format: 'float32x3', // Position
                    },
                    {
                        shaderLocation: 1,
                        offset: 12,
                        format: 'float32x3', // Normal
                    },
                    {
                        shaderLocation: 2,
                        offset: 24,
                        format: 'float32x3', // Tangent
                    },
                    {
                        shaderLocation: 3,
                        offset: 36,
                        format: 'float32x2', // UV0
                    },
                    {
                        shaderLocation: 4,
                        offset: 44,
                        format: 'float32x2', // UV1
                    },
                    {
                        shaderLocation: 5,
                        offset: 52,
                        format: 'float32x2', // UV2
                    },
                    {
                        shaderLocation: 6,
                        offset: 60,
                        format: 'float32x2', // UV3
                    },
                ],
            };
            Object.freeze(this.#staticMeshLayout); // 防止修改
        }
        return this.#staticMeshLayout;
    }

    /**
     * 获取骨骼网格顶点布局
     */
    static GetSkeletalMeshLayout() {
        if (!this.#skeletalMeshLayout) {
            this.#skeletalMeshLayout = {
                arrayStride: 80, // Static(60) + BoneIndices(4) + BoneWeights(16)
                attributes: [
                    ...this.GetStaticMeshLayout().attributes,
                    {
                        shaderLocation: 7,
                        offset: 68,
                        format: 'uint8x4', // BoneIndices
                        normalized: false,
                    },
                    {
                        shaderLocation: 8,
                        offset: 84,
                        format: 'float32x4', // BoneWeights
                    },
                ],
            };
            Object.freeze(this.#skeletalMeshLayout);
        }
        return this.#skeletalMeshLayout;
    }

    /**
     * 获取场景缓冲区名称配置
     */
    static GetSceneBuffers() {
        if (!this.#sceneBuffer) {
            this.#sceneBuffer = {
                name: 'sceneBufferBindGroup',
                layoutName: 'sceneBufferBindGroupLayout',
                // 矩阵
                matrices: {
                    name: 'VPMatrixsUniformBuffer',
                    values: {
                        model: {
                            name: 'ModelMatrix',
                            type: 'float4x4',
                            offset: 0
                        },
                        modelInverse: {
                            name: 'ModelInverseMatrix',
                            type: 'float4x4',
                            offset: 64  // 16 * 4
                        },
                        modelView: {
                            name: 'ModelViewMatrix',
                            type: 'float4x4',
                            offset: 128  // 16 * 4 * 2
                        },
                        modelViewInverse: {
                            name: 'ModelViewInverseMatrix',
                            type: 'float4x4',
                            offset: 192  // 16 * 4 * 3
                        },
                        modelViewProjection: {
                            name: 'ModelViewProjectionMatrix',
                            type: 'float4x4',
                            offset: 256  // 16 * 4 * 4
                        },
                        view: {
                            name: 'ViewMatrix',
                            type: 'float4x4',
                            offset: 320  // 16 * 4 * 5
                        },
                        projection: {
                            name: 'ProjectionMatrix',
                            type: 'float4x4',
                            offset: 384  // 16 * 4 * 6
                        },
                        viewProjection: {
                            name: 'ViewProjectionMatrix',
                            type: 'float4x4',
                            offset: 448  // 16 * 4 * 7
                        },
                        viewInverse: {
                            name: 'ViewInverseMatrix',
                            type: 'float4x4',
                            offset: 512  // 16 * 4 * 8
                        },
                        projectionInverse: {
                            name: 'ProjectionInverseMatrix',
                            type: 'float4x4',
                            offset: 576  // 16 * 4 * 9
                        },
                        viewProjectionInverse: {
                            name: 'ViewProjectionInverseMatrix',
                            type: 'float4x4',
                            offset: 640  // 16 * 4 * 10
                        }
                    },
                    totalSize: 704  // 16 * 4 * 11 (11个4x4矩阵)
                },
                // 相机属性
                camera: {
                    name: 'CameraAttrbuteUniformBuffer',
                    values: {
                        position: {
                            name: 'CameraPosition',
                            type: 'float3',
                            offset: 0
                        },
                        direction: {
                            name: 'CameraDirection',
                            type: 'float3',
                            offset: 16  // 考虑对齐
                        },
                        up: {
                            name: 'CameraUp',
                            type: 'float3',
                            offset: 32
                        },
                        right: {
                            name: 'CameraRight',
                            type: 'float3',
                            offset: 48
                        },
                        aspect: {
                            name: 'CameraAspect',
                            type: 'float',
                            offset: 64
                        }
                    },
                    totalSize: 68  // 16 * 4 + 4
                },
                // 场景参数
                Scene: {
                    name: 'SceneBufferUniformBuffer',
                    values: {
                        time: {
                            name: 'Time',
                            type: 'float2',  // time + deltaTime
                            offset: 0
                        }
                    },
                    totalSize: 8
                }
            };
            Object.freeze(this.#sceneBuffer);
        }
        return this.#sceneBuffer;
    }

    /**
     * 获取基础渲染状态配置
     */
    static GetBaseRenderStates() {
        if (!this.#baseRenderStates) {
            this.#baseRenderStates = {
                default: {
                    primitive: {
                        topology: 'triangle-list',
                        cullMode: 'back',
                    },
                    depthStencil: {
                        depthWriteEnabled: true,
                        depthCompare: 'less',
                        format: 'depth24plus',
                    },
                },
                transparent: {
                    primitive: {
                        topology: 'triangle-list',
                        cullMode: 'none',
                    },
                    depthStencil: {
                        depthWriteEnabled: false,
                        depthCompare: 'less',
                        format: 'depth24plus',
                    },
                },
            };
            Object.freeze(this.#baseRenderStates);
        }
        return this.#baseRenderStates;
    }

    /**
     * 获取基础资源描述
     * @param {string} name - 资源名称
     * @returns {Object} 资源描述
     */
    static GetBaseResourceDesc(name) {
        if (!this.#baseResourceDesc) {
            this.#baseResourceDesc = {
                texture: {
                    default: {
                        format: 'rgba8unorm',
                        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
                    },
                    depth: {
                        format: 'depth24plus',
                        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
                    },
                    gbuffer: {
                        format: 'rgba16float',
                        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
                    },
                },
                buffer: {
                    uniform: {
                        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
                    },
                    storage: {
                        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
                    },
                    vertex: {
                        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
                    },
                    index: {
                        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
                    },
                },
            };
            Object.freeze(this.#baseResourceDesc);
        }

        // 根据资源名称获取对应的描述
        const resourceNames = this.GetBaseResourceNames();

        // 检查是否是纹理资源
        for (const [category, textures] of Object.entries(resourceNames.texture)) {
            if (typeof textures === 'string' && textures === name) {
                if (name === 'EarlyZDepthTexture') {
                    return this.#baseResourceDesc.texture.depth;
                }
                return this.#baseResourceDesc.texture.default;
            }
            if (typeof textures === 'object') {
                for (const textureName of Object.values(textures)) {
                    if (textureName === name) {
                        if (category === 'GBuffer') {
                            return this.#baseResourceDesc.texture.gbuffer;
                        }
                        return this.#baseResourceDesc.texture.default;
                    }
                }
            }
        }

        // 检查是否是缓冲区资源
        if (name.includes('Buffer')) {
            if (name.includes('Uniform') || name === 'ViewProjectionMatrix') {
                return this.#baseResourceDesc.buffer.uniform;
            }
            if (name.includes('Storage') || name.includes('Transform')) {
                return this.#baseResourceDesc.buffer.storage;
            }
            if (name.includes('Vertex')) {
                return this.#baseResourceDesc.buffer.vertex;
            }
            if (name.includes('Index')) {
                return this.#baseResourceDesc.buffer.index;
            }
        }

        // 如果是动态资源，移除dynamic标记后重试
        if (name.includes('+dynamic')) {
            return this.GetBaseResourceDesc(name.replace('+dynamic', ''));
        }

        console.warn(`No resource description found for: ${name}`);
        return null;
    }

    static GetBaseResourceNames(name) {
        if (!this.#baseResourceNames) {
            this.#baseResourceNames = {
                buffer: {
                    SceneBuffer: this.GetSceneBuffers(),
                },
                texture: {
                    EarlyZDepthTexture: 'EarlyZDepthTexture',
                    GBuffer: {
                        GBufferA: 'GBufferA',
                        GBufferB: 'GBufferB',
                        GBufferC: 'GBufferC',
                        GBufferD: 'GBufferD',
                        GBufferE: 'GBufferE',
                    },
                    ShadowMap: 'ShadowMap+dynamic',
                },
            };
            Object.freeze(this.#baseResourceNames);
        }
        return this.#baseResourceNames;
    }

    /**
     * 获取所有受Canvassize影响的资源名称
     * 当Canvas尺寸变化时，需要重新创建这些资源
     */
    static GetAllTextureNameByCanvasSize() {
        return ['EarlyZDepthTexture', 'GBufferA', 'GBufferB', 'GBufferC', 'GBufferD', 'GBufferE'];
    }
}


export { ResourceConfig };
