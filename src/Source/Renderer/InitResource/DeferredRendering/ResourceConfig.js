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
    static #DefaultBIndgroups = null;
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
    static GetDefaultBIndgroups() {
        if (!this.#DefaultBIndgroups) {
            this.#DefaultBIndgroups = {
                //默认slot0
                BindGroupSlot0:{
                    defaultSlot:0,
                    name: 'SceneBufferBindGroup',
                    layoutName: 'SceneBufferBindGroupLayout',
                    layout:{
                        entries: [
                            {
                                /**
                                 * 视图投影矩阵
                                 * view mat4x4f viewInverse mat4x4f
                                 * projection mat4x4f projectionInverse mat4x4f
                                 */
                                binding:0,
                                resource:{
                                    buffer:{
                                        name: 'ViewProjectionMatrixUniformBuffer',
                                        type: 'uniform',
                                        size: 256,
                                    }
                                },
                            },
                            {
                                /**
                                 * 相机信息
                                 * 位置 f3、方向 f3、上 f3、右 f3、宽高比 f1 
                                 */
                                binding:1,
                                resource:{
                                    buffer:{
                                        name: 'CameraInfoUniformBuffer',
                                        type: 'uniform',
                                        size: 256,
                                    }
                                },
                            },
                            {
                                /**
                                 * 时间
                                 * 时间 f2、时间差 f2
                                 */
                                binding:2,
                                resource:{
                                    buffer:{
                                        name: 'TimeUniformBuffer',
                                        type: 'uniform',
                                        size: 8,
                                    }
                                },
                            }
                        ]
                    }
                },
                //默认slot1  Mesh相关BIndgroup
                BindGroupSlot1:{
                    //如果这次drawCall使用的是静态网格
                    StaticMesh:{
                        defaultSlot:1,
                        name: 'StaticMeshBufferBindGroup',
                        layoutName: 'StaticMeshBufferBindGroupLayout',
                        layout:{
                        entries: [
                            {
                                /**
                                 * 模型矩阵
                                 * model mat4x4f modelInverse mat4x4f
                                 */
                                binding:0,
                                resource:{
                                    buffer:{
                                        name: 'StaticMeshUniformBuffer',
                                        type: 'uniform',
                                        size: 128,
                                    }
                                },
                            }
                        ]
                    },
                    //如果这次drawCall使用的是骨骼网格
                    SkeletalMesh:{
                        defaultSlot:1,
                        name: 'SkeletalMeshBufferBindGroup',
                        layoutName: 'SkeletalMeshBufferBindGroupLayout',
                        layout:{
                            entries: [
                                {
                                    /**
                                     * 模型矩阵
                                     * model mat4x4f modelInverse mat4x4f
                                     */
                                    binding:0,
                                    resource:{
                                        buffer:{
                                            name: 'SkeletalMeshUniformBuffer',
                                            type: 'uniform',
                                            size: 128,
                                        }
                                    }
                                },
                                {
                                    /**
                                     * 骨骼矩阵
                                     * bone mat4x4f
                                     */
                                    binding:1,
                                    resource:{
                                        buffer:{
                                            name: 'SkeletalMeshBoneMatrixUniformBuffer',
                                            type: 'uniform',
                                            size: null,//每个骨骼网格体骨骼数不同
                                        }
                                    }
                                }
                            ]
                        }
                    },
                    //如果这次drawCall使用的是实例化网格
                    InstancedMesh:{
                        defaultSlot:1,
                        name: 'InstancedMeshBufferBindGroup',
                        layoutName: 'InstancedMeshBufferBindGroupLayout',
                        layout:{
                            entries: [
                                {
                                    /**
                                     * 模型矩阵
                                     * model mat4x4f modelInverse mat4x4f
                                     */
                                    binding:0,
                                    resource:{
                                        buffer:{
                                            name: 'InstancedMeshStorageBuffer',
                                            type: 'storage',
                                            size: null,//n*128  ，n是实例化网格数量
                                        }
                                    }
                                },
                                {
                                    /**
                                     * 实例化矩阵
                                     * instance mat4x4f
                                     */
                                    binding:1,
                                    resource:{
                                        buffer:{
                                            name: 'InstancedMeshUniformBufferIdx',
                                            type: 'uniform',
                                            size: 4,
                                        }
                                    }
                                }
                            ]
                        }
                    }
                }
            }
            };
            Object.freeze(this.#DefaultBIndgroups);
        }
        return this.#DefaultBIndgroups;
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
                    SceneBuffer: this.GetDefaultBIndgroups(),
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
