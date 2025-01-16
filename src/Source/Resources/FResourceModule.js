import { FRenderResource } from './BaseResource/FRenderResource';
import { FBuffer } from './BaseResource/Buffer/FBuffer';
import { FVertexBuffer } from './BaseResource/Buffer/FVertexBuffer';
import { FIndexBuffer } from './BaseResource/Buffer/FIndexBuffer';
import { FUniformBuffer } from './BaseResource/Buffer/FUniformBuffer';
import { FTexture } from './BaseResource/Textures/FTexture';
import { FSampler } from './BaseResource/Sampler/FSampler';
import { FBindGroup } from './BaseResource/BindGroup/FBindGroup';
import { FBindGroupLayout } from './BaseResource/BindGroup/FBindGroupLayout';
import { FPipelineState } from './BaseResource/PipelineState/FPipelineState';
import { FGraphicsPipelineState } from './BaseResource/PipelineState/FGraphicsPipelineState';
import { FComputePipelineState } from './BaseResource/PipelineState/FComputePipelineState';
import { FStaticMeshVertexBuffer } from './BaseResource/Buffer/FStaticMeshVertexBuffer';
import { FSkeletalMeshVertexBuffer } from './BaseResource/Buffer/FSkeletalMeshVertexBuffer';
import { FTexture2D } from './BaseResource/Textures/FTexture2D';
import { FTextureDepth, EDepthFormat } from './BaseResource/Textures/FTextureDepth';
import { FGBufferTexture2D, EGBufferType } from './BaseResource/Textures/FGBufferTexture2D';
import { FTexture3D } from './BaseResource/Textures/FTexture3D';
import { FRenderTargetTexture2D } from './BaseResource/Textures/FRenderTargetTexture2D';
import IModule from '../Core/IModule';

// 修改 Buffer 使用标志常量，使用 WebGPU 原生的标志位值
const EBufferUsage = {
    VERTEX:        0x0001,  // GPUBufferUsage.VERTEX
    INDEX:         0x0002,  // GPUBufferUsage.INDEX
    UNIFORM:       0x0004,  // GPUBufferUsage.UNIFORM
    STORAGE:       0x0008,  // GPUBufferUsage.STORAGE
    INDIRECT:      0x0010,  // GPUBufferUsage.INDIRECT
    MAP_READ:      0x0020,  // GPUBufferUsage.MAP_READ
    MAP_WRITE:     0x0040,  // GPUBufferUsage.MAP_WRITE
    COPY_SRC:      0x0080,  // GPUBufferUsage.COPY_SRC
    COPY_DST:      0x0100,  // GPUBufferUsage.COPY_DST
};

/**
 * 资源管理模块
 * 负责管理所有GPU资源的生命周期
 */
export class FResourceModule extends IModule {
    /**
     * 获取单例实例
     * @returns {FResourceModule}
     */
    static Get() {
        if (!FResourceModule.instance) {
            FResourceModule.instance = new FResourceModule();
        }
        return FResourceModule.instance;
    }

    constructor() {
        super();
        
        if (FResourceModule.instance) {
            throw new Error('FResourceModule is a singleton class');
        }

        /**
         * GPU设备
         * @type {GPUDevice}
         * @private
         */
        this._device = null;
        /**
         * GPU适配器
         * @type {GPUAdapter}
         * @private
         */
        this._adapter = null;

        /**
         * 资源映射表
         * @type {Map<string, FRenderResource>}
         * @private
         */
        this._resources = new Map();

        /**
         * 管线状态映射表
         * @type {Map<string, FPipelineState>}
         * @private
         */
        this._pipelineStates = new Map();

        /**
         * 待释放的资源队列
         * @type {Set<FRenderResource>}
         * @private
         */
        this._pendingDelete = new Set();

        /**
         * 资源加载队列
         * @type {Array<{resource: FRenderResource, promise: Promise}>}
         * @private
         */
        this._loadingQueue = [];

        /**
         * 自动垃圾回收间隔（毫秒）
         * @type {number}
         * @private
         */
        this._gcInterval = 5000;

        /**
         * 上次垃圾回收时间
         * @type {number}
         * @private
         */
        this._lastGCTime = 0;
    }


    /**
     * 获取GPU适配器
     * @returns {GPUAdapter}
     */
    GetAdapter() {
        return this._adapter;
    }

    /**
     * 获取GPU设备
     * @returns {GPUDevice}
     */
    GetDevice() {
        return this._device;
    }

    /**
     * 初始化资源管理器
     * @override
     */
    async Initialize() {
        this._adapter = await navigator.gpu.requestAdapter();
        this._device = await this._adapter.requestDevice();


        // 启动自动垃圾回收
        this._startGarbageCollection();
    }

    /**
     * 更新资源管理器
     * @param {number} deltaTime - 时间增量（秒）
     * @override
     */
    Update(deltaTime) {
        // 处理待释放的资源
        this._processPendingDeletes();

        // 检查是否需要进行垃圾回收
        const currentTime = performance.now();
        if (currentTime - this._lastGCTime > this._gcInterval) {
            this._collectGarbage();
            this._lastGCTime = currentTime;
        }

        // 处理资源加载队列
        this._processLoadingQueue();
    }

    /**
     * 关闭资源管理器
     * @override
     */
    async Shutdown() {
        // 清理所有资源
        this.Cleanup();

        // 重置状态
        this._device = null;
        this._resources.clear();
        this._pipelineStates.clear();
        this._pendingDelete.clear();
        this._loadingQueue = [];
    }

    /**
     * 启动自动垃圾回收
     * @private
     */
    _startGarbageCollection() {
        setInterval(() => {
            this._collectGarbage();
        }, this._gcInterval);
    }

    /**
     * 收集垃圾（未引用的资源）
     * @private
     */
    _collectGarbage() {
        for (const [name, resource] of this._resources) {
            if (resource.refCount <= 0) {
                this._pendingDelete.add(resource);
            }
        }
    }

    /**
     * 处理待释放的资源
     * @private
     */
    _processPendingDeletes() {
        for (const resource of this._pendingDelete) {
            this.DestroyResource(resource);
        }
        this._pendingDelete.clear();
    }

    /**
     * 处理资源加载队列
     * @private
     */
    async _processLoadingQueue() {
        const currentQueue = [...this._loadingQueue];
        this._loadingQueue = [];

        for (const item of currentQueue) {
            try {
                await item.promise;
            } catch (error) {
                console.error('Failed to load resource:', error);
            }
        }
    }

    /**
     * 查找资源
     * @param {string} name - 资源名称
     * @param {string} type - 资源类型
     * @returns {FRenderResource|null} 资源对象
     * @private
     */
    _findResource(name, type) {
        const resource = this._resources.get(name);
        if (resource && resource.constructor.name === type) {
            return resource;
        }
        return null;
    }

    /**
     * 生成唯一资源名称
     * @param {string} baseName - 基础名称
     * @param {string} type - 资源类型
     * @returns {string} 唯一名称
     * @private
     */
    _generateUniqueName(baseName, type) {
        // 如果提供了基础名称，直接使用
        if (baseName) {
            // 如果名称已存在，则添加数字后缀
            let name = baseName;
            let counter = 1;
            while (this._resources.has(name)) {
                name = `${baseName}_${counter++}`;
            }
            return name;
        }
        
        // 如果没有提供名称，则生成一个带类型前缀的UUID
        return `${type}_${crypto.randomUUID()}`;
    }



    /**
     * 创建纹理
     * @param {GPUTextureDescriptor} desc - 纹理描述符
     * @returns {FTexture} 纹理
     */
    CreateTexture(desc) {
        // 如果提供了名称，检查是否已存在
        if (desc.name) {
            const existingTexture = this._findResource(desc.name, 'FTexture');
            if (existingTexture) {
                // 检查纹理属性是否匹配
                if (existingTexture.width === desc.width &&
                    existingTexture.height === desc.height &&
                    existingTexture.format === desc.format &&
                    existingTexture.usage === desc.usage) {
                    this.AddRef(existingTexture);
                    return existingTexture;
                }
            }
        }

        // 生成唯一名称
        desc.name = this._generateUniqueName(desc.name, 'Texture');

        const texture = new FTexture(this._device, desc);
        this.AddRef(texture);
        return texture;
    }

    /**
     * 创建图形管线状态
     * @param {Object} desc - 图形管线状态描述符
     * @param {string} [desc.name] - 资源名称
     * @param {PipelineLayoutDescriptor} desc.layout - 管线布局描述符
     * @param {GraphicsPipelineStateDescriptor} desc.graphics - 图形管线状态描述符
     * @returns {FGraphicsPipelineState} 图形管线状态
     */
    CreateGraphicsPipeline(desc) {
        // 如果提供了名称，检查是否已存在
        if (desc.name) {
            const existingPipeline = this._findResource(desc.name, 'FGraphicsPipelineState');
            if (existingPipeline) {
                this.AddRef(existingPipeline);
                return existingPipeline;
            }
        }

        // 生成唯一名称
        desc.name = this._generateUniqueName(desc.name, 'GraphicsPipeline');

        const pipeline = new FGraphicsPipelineState(this._device, desc);
        this._pipelineStates.set(pipeline.name, pipeline);
        this.AddRef(pipeline);
        return pipeline;
    }

    /**
     * 创建计算管线状态
     * @param {Object} desc - 计算管线状态描述符
     * @param {string} [desc.name] - 资源名称
     * @param {PipelineLayoutDescriptor} desc.layout - 管线布局描述符
     * @param {ComputePipelineStateDescriptor} desc.compute - 计算管线状态描述符
     * @returns {FComputePipelineState} 计算管线状态
     */
    CreateComputePipeline(desc) {
        // 如果提供了名称，检查是否已存在
        if (desc.name) {
            const existingPipeline = this._findResource(desc.name, 'FComputePipelineState');
            if (existingPipeline) {
                this.AddRef(existingPipeline);
                return existingPipeline;
            }
        }

        // 生成唯一名称
        desc.name = this._generateUniqueName(desc.name, 'ComputePipeline');

        const pipeline = new FComputePipelineState(this._device, desc);
        this._pipelineStates.set(pipeline.name, pipeline);
        this.AddRef(pipeline);
        return pipeline;
    }

    /**
     * 创建管线状态（通用方法）
     * @param {Object} desc - 管线状态描述符
     * @returns {FPipelineState} 管线状态
     */
    CreatePipelineState(desc) {
        if (desc.compute) {
            return this.CreateComputePipeline(desc);
        } else if (desc.graphics) {
            return this.CreateGraphicsPipeline(desc);
        } else {
            throw new Error('Invalid pipeline state descriptor: must specify either compute or graphics');
        }
    }

    /**
     * 获取资源
     * @param {string} id - 资源ID
     * @returns {FRenderResource} 资源对象
     */
    GetResource(id) {
        return this._resources.get(id);
    }

    /**
     * 增加资源引用计数
     * @param {FRenderResource} resource - 资源对象
     */
    AddRef(resource) {
        if (!resource.name) {
            resource.name = crypto.randomUUID();
        }
        this._resources.set(resource.name, resource);
        resource.AddRef();
    }

    /**
     * 减少资源引用计数
     * @param {FRenderResource} resource - 资源对象
     */
    Release(resource) {
        resource.Release();
        if (resource.refCount <= 0) {
            this.DestroyResource(resource);
        }
    }

    /**
     * 销毁资源
     * @private
     * @param {FRenderResource} resource - 资源对象
     */
    DestroyResource(resource) {
        this._resources.delete(resource.name);
        this._pipelineStates.delete(resource.name);
        resource.destroy();
    }

    /**
     * 清理所有资源
     */
    Cleanup() {
        for (const resource of this._resources.values()) {
            this.DestroyResource(resource);
        }
    }

    /**
     * 创建资源句柄
     * @param {FRenderResource} resource - 资源对象
     * @returns {Object} 资源句柄
     */
    CreateResourceHandle(resource) {
        return {
            id: resource.name,
            type: resource.constructor.name,
            refCount: resource.refCount
        };
    }

    /**
     * 加载资源
     * @param {string} url - 资源URL
     * @returns {Promise<Object>} 资源句柄
     */
    async LoadResource(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.arrayBuffer();
            
            // 根据URL后缀决定资源类型
            let resource;
            if (url.endsWith('.png') || url.endsWith('.jpg')) {
                resource = await this.CreateTexture({
                    name: url,
                    source: data
                });
            } else {
                resource = await this.CreateBuffer({
                    name: url,
                    size: data.byteLength,
                    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
                    mappedAtCreation: true,
                    initialData: data
                });
            }

            return this.CreateResourceHandle(resource);
        } catch (error) {
            console.error(`Failed to load resource ${url}:`, error);
            throw error;
        }
    }

    /**
     * 加载资源组
     * @param {Object} group - 资源组描述符
     * @returns {Promise<void>}
     */
    async LoadResourceGroup(group) {
        const promises = group.resources.map(url => this.LoadResource(url));
        await Promise.all(promises);
    }

    /**
     * 获取资源统计信息
     * @returns {Object} 统计信息
     */
    GetResourceStats() {
        const bufferCount = Array.from(this._resources.values())
            .filter(r => r instanceof FBuffer).length;
        const textureCount = Array.from(this._resources.values())
            .filter(r => r instanceof FTexture).length;
        
        return {
            loadingQueueSize: this._loadingQueue.length,
            pendingDeleteCount: this._pendingDelete.size,
            totalResourceCount: this._resources.size,
            totalPipelineStateCount: this._pipelineStates.size,
            bufferCount,
            textureCount,
            memoryUsage: this._calculateTotalMemoryUsage()
        };
    }

    /**
     * 设置垃圾回收间隔
     * @param {number} interval - 间隔时间（毫秒）
     */
    SetGCInterval(interval) {
        this._gcInterval = interval;
    }

    /**
     * 强制进行垃圾回收
     */
    ForceGarbageCollection() {
        this._collectGarbage();
        this._processPendingDeletes();
    }

    _calculateTotalMemoryUsage() {
        let totalSize = 0;
        for (const resource of this._resources.values()) {
            if (resource instanceof FBuffer) {
                totalSize += resource.size;
            } else if (resource instanceof FTexture) {
                totalSize += resource.width * resource.height * 4; // 估算值
            }
        }
        return totalSize;
    }

    /**
     * 创建缓冲区
     * @param {GPUBufferDescriptor} desc - 缓冲区描述符
     * @returns {FBuffer} 缓冲区
     */
    CreateBuffer(desc) {
        if (!desc || typeof desc !== 'object') {
            throw new Error('Invalid buffer descriptor');
        }

        // 验证 usage 标志位组合
        if ((desc.usage & EBufferUsage.MAP_READ) !== 0) {
            if (desc.usage !== (EBufferUsage.MAP_READ | EBufferUsage.COPY_DST)) {
                throw new Error('MAP_READ buffers can only be combined with COPY_DST usage');
            }
        }

        // 如果提供了名称，检查是否已存在
        if (desc.name) {
            const existingBuffer = this._findResource(desc.name, 'FBuffer');
            if (existingBuffer) {
                // 检查缓冲区属性是否匹配
                if (existingBuffer.size === desc.size && existingBuffer.usage === desc.usage) {
                    this.AddRef(existingBuffer);
                    return existingBuffer;
                }
            }
        }

        // 生成唯一名称
        desc.name = this._generateUniqueName(desc.name, 'Buffer');

        const buffer = new FBuffer(this._device, {
            ...desc,
            usage: desc.usage || EBufferUsage.COPY_DST
        });
        this.AddRef(buffer);
        return buffer;
    }

    /**
     * 创建顶点缓冲区
     * @param {Object} desc - 顶点缓冲区描述符
     * @param {string} [desc.name] - 资源名称
     * @param {number} desc.size - Buffer大小（字节）
     * @param {number} desc.stride - 每个顶点的字节大小
     * @param {VertexAttributeDescriptor[]} desc.attributes - 顶点属性描述符数组
     * @param {ArrayBuffer|TypedArray} [desc.initialData] - 初始数据
     * @returns {FVertexBuffer} 顶点缓冲区
     */
    CreateVertexBuffer(desc) {
        // 如果提供了名称，检查是否已存在
        if (desc.name) {
            const existingBuffer = this._findResource(desc.name, 'FVertexBuffer');
            if (existingBuffer) {
                // 检查缓冲区属性是否匹配
                if (existingBuffer.size === desc.size && 
                    existingBuffer.stride === desc.stride) {
                    this.AddRef(existingBuffer);
                    return existingBuffer;
                }
            }
        }

        // 生成唯一名称
        desc.name = this._generateUniqueName(desc.name, 'VertexBuffer');

        const buffer = new FVertexBuffer(this._device, desc);
        this.AddRef(buffer);
        return buffer;
    }

    /**
     * 创建索引缓冲区
     * @param {Object} desc - 索引缓冲区描述符
     * @param {string} [desc.name] - 资源名称
     * @param {number} desc.size - Buffer大小（字节）
     * @param {EIndexFormat} [desc.format=EIndexFormat.UINT32] - 索引格式
     * @param {ArrayBuffer|TypedArray} [desc.initialData] - 初始数据
     * @returns {FIndexBuffer} 索引缓冲区
     */
    CreateIndexBuffer(desc) {
        // 如果提供了名称，检查是否已存在
        if (desc.name) {
            const existingBuffer = this._findResource(desc.name, 'FIndexBuffer');
            if (existingBuffer) {
                // 检查缓冲区属性是否匹配
                if (existingBuffer.size === desc.size && 
                    existingBuffer.format === desc.format) {
                    this.AddRef(existingBuffer);
                    return existingBuffer;
                }
            }
        }

        // 生成唯一名称
        desc.name = this._generateUniqueName(desc.name, 'IndexBuffer');

        const buffer = new FIndexBuffer(this._device, desc);
        this.AddRef(buffer);
        return buffer;
    }

    /**
     * 创建Uniform缓冲区
     * @param {Object} desc - Uniform缓冲区描述符
     * @param {string} [desc.name] - 资源名称
     * @param {number} desc.size - Buffer大小（字节）
     * @param {boolean} [desc.dynamic=true] - 是否为动态Uniform Buffer
     * @param {ArrayBuffer|TypedArray} [desc.initialData] - 初始数据
     * @returns {FUniformBuffer} Uniform缓冲区
     */
    CreateUniformBuffer(desc) {
        // 如果提供了名称，检查是否已存在
        if (desc.name) {
            const existingBuffer = this._findResource(desc.name, 'FUniformBuffer');
            if (existingBuffer) {
                // 检查缓冲区属性是否匹配
                if (existingBuffer.size === desc.size && 
                    existingBuffer.dynamic === desc.dynamic) {
                    this.AddRef(existingBuffer);
                    return existingBuffer;
                }
            }
        }

        // 生成唯一名称
        desc.name = this._generateUniqueName(desc.name, 'UniformBuffer');

        const buffer = new FUniformBuffer(this._device, desc);
        this.AddRef(buffer);
        return buffer;
    }

    /**
     * 创建静态网格顶点缓冲区
     * @param {Object} desc - 静态网格顶点缓冲区描述符
     * @param {string} [desc.name] - 资源名称
     * @param {number} desc.vertexCount - 顶点数量
     * @param {boolean} [desc.hasVertexColors=false] - 是否包含顶点颜色
     * @param {ArrayBuffer|TypedArray} [desc.initialData] - 初始数据
     * @returns {FStaticMeshVertexBuffer} 静态网格顶点缓冲区
     */
    CreateStaticMeshVertexBuffer(desc) {
        // 如果提供了名称，检查是否已存在
        if (desc.name) {
            const existingBuffer = this._findResource(desc.name, 'FStaticMeshVertexBuffer');
            if (existingBuffer) {
                // 检查缓冲区属性是否匹配
                if (existingBuffer.vertexCount === desc.vertexCount && 
                    existingBuffer.hasVertexColors === desc.hasVertexColors) {
                    this.AddRef(existingBuffer);
                    return existingBuffer;
                }
            }
        }

        // 生成唯一名称
        desc.name = this._generateUniqueName(desc.name, 'StaticMeshVertexBuffer');

        const buffer = new FStaticMeshVertexBuffer(this._device, desc);
        this.AddRef(buffer);
        return buffer;
    }

    /**
     * 创建骨骼网格顶点缓冲区
     * @param {Object} desc - 骨骼网格顶点缓冲区描述符
     * @param {string} [desc.name] - 资源名称
     * @param {number} desc.vertexCount - 顶点数量
     * @param {boolean} [desc.hasVertexColors=false] - 是否包含顶点颜色
     * @param {number} [desc.maxBoneInfluences=4] - 每个顶点最大骨骼影响数
     * @param {boolean} [desc.use16BitBoneIndices=false] - 是否使用16位骨骼索引
     * @param {ArrayBuffer|TypedArray} [desc.initialData] - 初始数据
     * @returns {FSkeletalMeshVertexBuffer} 骨骼网格顶点缓冲区
     */
    CreateSkeletalMeshVertexBuffer(desc) {
        // 如果提供了名称，检查是否已存在
        if (desc.name) {
            const existingBuffer = this._findResource(desc.name, 'FSkeletalMeshVertexBuffer');
            if (existingBuffer) {
                // 检查缓冲区属性是否匹配
                if (existingBuffer.vertexCount === desc.vertexCount && 
                    existingBuffer.hasVertexColors === desc.hasVertexColors &&
                    existingBuffer.maxBoneInfluences === desc.maxBoneInfluences &&
                    existingBuffer.use16BitBoneIndices === desc.use16BitBoneIndices) {
                    this.AddRef(existingBuffer);
                    return existingBuffer;
                }
            }
        }

        // 生成唯一名称
        desc.name = this._generateUniqueName(desc.name, 'SkeletalMeshVertexBuffer');

        const buffer = new FSkeletalMeshVertexBuffer(this._device, desc);
        this.AddRef(buffer);
        return buffer;
    }

    /**
     * 创建2D纹理
     * @param {Object} desc - 2D纹理描述符
     * @param {string} [desc.name] - 资源名称
     * @param {ETextureFormat} [desc.format] - 纹理格式
     * @param {number} desc.width - 纹理宽度
     * @param {number} desc.height - 纹理高度
     * @param {number} [desc.mipLevelCount] - Mipmap级别数
     * @param {boolean} [desc.generateMips] - 是否生成Mipmap
     * @returns {FTexture2D} 2D纹理
     */
    CreateTexture2D(desc) {
        // 如果提供了名称，检查是否已存在
        if (desc.name) {
            const existingTexture = this._findResource(desc.name, 'FTexture2D');
            if (existingTexture) {
                // 检查纹理属性是否匹配
                if (existingTexture.width === desc.width &&
                    existingTexture.height === desc.height &&
                    existingTexture.format === desc.format) {
                    this.AddRef(existingTexture);
                    return existingTexture;
                }
            }
        }

        // 生成唯一名称
        desc.name = this._generateUniqueName(desc.name, 'Texture2D');

        const texture = new FTexture2D(this._device, desc);
        this.AddRef(texture);
        return texture;
    }

    /**
     * 创建深度纹理
     * @param {Object} desc - 深度纹理描述符
     * @param {string} [desc.name] - 资源名称
     * @param {EDepthFormat} [desc.format] - 深度格式
     * @param {number} desc.width - 纹理宽度
     * @param {number} desc.height - 纹理高度
     * @param {boolean} [desc.hasStencil] - 是否包含模板
     * @param {number} [desc.sampleCount] - MSAA采样数
     * @returns {FTextureDepth} 深度纹理
     */
    CreateDepthTexture(desc) {
        // 如果提供了名称，检查是否已存在
        if (desc.name) {
            const existingTexture = this._findResource(desc.name, 'FTextureDepth');
            if (existingTexture) {
                // 检查纹理属性是否匹配
                if (existingTexture.width === desc.width &&
                    existingTexture.height === desc.height &&
                    existingTexture.format === desc.format &&
                    existingTexture.hasStencil === desc.hasStencil) {
                    this.AddRef(existingTexture);
                    return existingTexture;
                }
            }
        }

        // 生成唯一名称
        desc.name = this._generateUniqueName(desc.name, 'DepthTexture');

        const texture = new FTextureDepth(this._device, desc);
        this.AddRef(texture);
        return texture;
    }

    /**
     * 创建GBuffer纹理
     * @param {Object} desc - GBuffer纹理描述符
     * @param {string} [desc.name] - 资源名称
     * @param {EGBufferType} desc.bufferType - GBuffer类型
     * @param {number} desc.width - 纹理宽度
     * @param {number} desc.height - 纹理高度
     * @param {number} [desc.sampleCount] - MSAA采样数
     * @returns {FGBufferTexture2D} GBuffer纹理
     */
    CreateGBufferTexture(desc) {
        // 如果提供了名称，检查是否已存在
        if (desc.name) {
            const existingTexture = this._findResource(desc.name, 'FGBufferTexture2D');
            if (existingTexture) {
                // 检查纹理属性是否匹配
                if (existingTexture.width === desc.width &&
                    existingTexture.height === desc.height &&
                    existingTexture.bufferType === desc.bufferType) {
                    this.AddRef(existingTexture);
                    return existingTexture;
                }
            }
        }

        // 生成唯一名称
        desc.name = this._generateUniqueName(desc.name, 'GBuffer');

        const texture = new FGBufferTexture2D(this._device, desc);
        this.AddRef(texture);
        return texture;
    }

    /**
     * 创建3D纹理
     * @param {Object} desc - 3D纹理描述符
     * @param {string} [desc.name] - 资源名称
     * @param {ETextureFormat} [desc.format] - 纹理格式
     * @param {number} desc.width - 纹理宽度
     * @param {number} desc.height - 纹理高度
     * @param {number} desc.depth - 纹理深度
     * @param {number} [desc.mipLevelCount] - Mipmap级别数
     * @returns {FTexture3D} 3D纹理
     */
    CreateTexture3D(desc) {
        // 如果提供了名称，检查是否已存在
        if (desc.name) {
            const existingTexture = this._findResource(desc.name, 'FTexture3D');
            if (existingTexture) {
                // 检查纹理属性是否匹配
                if (existingTexture.width === desc.width &&
                    existingTexture.height === desc.height &&
                    existingTexture.depth === desc.depth &&
                    existingTexture.format === desc.format) {
                    this.AddRef(existingTexture);
                    return existingTexture;
                }
            }
        }

        // 生成唯一名称
        desc.name = this._generateUniqueName(desc.name, 'Texture3D');

        const texture = new FTexture3D(this._device, desc);
        this.AddRef(texture);
        return texture;
    }

    /**
     * 创建渲染目标纹理
     * @param {Object} desc - 渲染目标纹理描述符
     * @param {string} [desc.name] - 资源名称
     * @param {ETextureFormat} [desc.format] - 纹理格式
     * @param {number} desc.width - 纹理宽度
     * @param {number} desc.height - 纹理高度
     * @param {number} [desc.sampleCount] - MSAA采样数
     * @param {GPUColor} [desc.clearValue] - 清除颜色
     * @returns {FRenderTargetTexture2D} 渲染目标纹理
     */
    CreateRenderTargetTexture(desc) {
        // 如果提供了名称，检查是否已存在
        if (desc.name) {
            const existingTexture = this._findResource(desc.name, 'FRenderTargetTexture2D');
            if (existingTexture) {
                // 检查纹理属性是否匹配
                if (existingTexture.width === desc.width &&
                    existingTexture.height === desc.height &&
                    existingTexture.format === desc.format &&
                    existingTexture.sampleCount === desc.sampleCount) {
                    this.AddRef(existingTexture);
                    return existingTexture;
                }
            }
        }

        // 生成唯一名称
        desc.name = this._generateUniqueName(desc.name, 'RenderTarget');

        const texture = new FRenderTargetTexture2D(this._device, desc);
        this.AddRef(texture);
        return texture;
    }
}

// 单例实例
FResourceModule.instance = null; 