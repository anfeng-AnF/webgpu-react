import { FRenderResource } from './BaseResource/FRenderResource';
import { FBuffer } from './BaseResource/Buffer/FBuffer';
import { FVertexBuffer } from './BaseResource/Buffer/FVertexBuffer';
import { FIndexBuffer } from './BaseResource/Buffer/FIndexBuffer';
import { FUniformBuffer } from './BaseResource/Buffer/FUniformBuffer';
import { FTexture } from './BaseResource/Textures/FTexture';
import { FSampler } from './BaseResource/Textures/FSampler';
import { FBindGroup } from './BaseResource/BindGroup/FBindGroup';
import { FBindGroupLayout } from './BaseResource/BindGroup/FBindGroupLayout';
import { FPipelineState } from './BaseResource/PipelineState/FPipelineState';
import { FGraphicsPipelineState } from './BaseResource/PipelineState/FGraphicsPipelineState';
import { FComputePipelineState } from './BaseResource/PipelineState/FComputePipelineState';
import { FResourceCache } from './FResourceCache';
import { FResourceMonitor } from './FResourceMonitor';

// 添加 Buffer 使用标志常量
const EBufferUsage = {
    VERTEX: 0x0001,
    INDEX: 0x0002,
    UNIFORM: 0x0004,
    STORAGE: 0x0008,
    COPY_DST: 0x0010,
    COPY_SRC: 0x0020,
    MAP_READ: 0x0040,
    MAP_WRITE: 0x0080
};

/**
 * 资源管理器类
 * 负责管理所有GPU资源的生命周期
 */
export class FResourceManager {
    /**
     * 获取单例实例
     * @returns {FResourceManager}
     */
    static Get() {
        if (!FResourceManager.instance) {
            FResourceManager.instance = new FResourceManager();
        }
        return FResourceManager.instance;
    }

    constructor() {
        if (FResourceManager.instance) {
            throw new Error('FResourceManager is a singleton class');
        }

        /**
         * GPU设备
         * @type {GPUDevice}
         * @private
         */
        this._device = null;

        /**
         * 资源缓存
         * @type {FResourceCache}
         */
        this.cache = new FResourceCache();

        /**
         * 资源监控
         * @type {FResourceMonitor}
         */
        this.monitor = new FResourceMonitor();

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
    }

    /**
     * 初始化资源管理器
     * @param {GPUDevice} device - GPU设备
     */
    Initialize(device) {
        this._device = device;
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
        let name = baseName || `${type}_${crypto.randomUUID()}`;
        let counter = 1;
        while (this._resources.has(name)) {
            name = `${baseName}_${counter++}`;
        }
        return name;
    }

    /**
     * 创建缓冲区
     * @param {GPUBufferDescriptor} desc - 缓冲区描述符
     * @returns {FBuffer} 缓冲区
     */
    CreateBuffer(desc) {
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
        this.monitor.trackResourceCreation('Buffer', buffer.size);
        return buffer;
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
        this.monitor.trackResourceCreation('Texture', texture.size);
        return texture;
    }

    /**
     * 创建管线状态
     * @param {Object} desc - 管线状态描述符
     * @returns {FPipelineState} 管线状态
     */
    CreatePipelineState(desc) {
        // 如果提供了名称，检查是否已存在
        if (desc.name) {
            const existingPipeline = this._findResource(desc.name, desc.compute ? 'FComputePipelineState' : 'FGraphicsPipelineState');
            if (existingPipeline) {
                this.AddRef(existingPipeline);
                return existingPipeline;
            }
        }

        // 生成唯一名称
        desc.name = this._generateUniqueName(desc.name, desc.compute ? 'ComputePipeline' : 'GraphicsPipeline');

        let pipeline;
        if (desc.compute) {
            pipeline = new FComputePipelineState(this._device, desc);
        } else {
            pipeline = new FGraphicsPipelineState(this._device, desc);
        }
        this._pipelineStates.set(pipeline.name, pipeline);
        this.AddRef(pipeline);
        this.monitor.trackResourceCreation('PipelineState', 0);
        return pipeline;
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
        this.monitor.trackResourceDestruction(resource.constructor.name, resource.GetSize());
        resource.destroy();
    }

    /**
     * 清理所有资源
     */
    Cleanup() {
        for (const resource of this._resources.values()) {
            this.DestroyResource(resource);
        }
        this.cache.clear();
        this.monitor.clear();
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
        // 检查缓存
        const cachedResource = this.cache.get(url);
        if (cachedResource) {
            return this.CreateResourceHandle(cachedResource);
        }

        try {
            const startTime = performance.now();
            const response = await fetch(url);
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

            const loadTime = performance.now() - startTime;
            this.monitor.trackMetric('resourceLoadTime', loadTime);

            // 添加到缓存
            this.cache.add(url, resource, resource.GetSize());

            return this.CreateResourceHandle(resource);
        } catch (error) {
            this.monitor.trackError('ResourceLoad', `Failed to load resource ${url}: ${error.message}`);
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
        return {
            ...this.monitor.generateReport(),
            cacheStats: this.cache.getStats()
        };
    }

    /**
     * 处理资源错误
     * @param {Error} error - 错误对象
     */
    HandleResourceError(error) {
        this.monitor.trackError('ResourceError', error.message);
        console.error('Resource Error:', error);
    }
}

// 单例实例
FResourceManager.instance = null; 