import { FResource } from './BaseResource/FResource';
import { FBindGroup } from './BaseResource/BindGroup/FBindGroup';
import { FPipeline } from './BaseResource/Pipeline/FPipeline';
import { FVertexBuffer } from './BaseResource/Buffer/FVertexBuffer';
import { FIndexBuffer } from './BaseResource/Buffer/FIndexBuffer';
import { FUniformBuffer } from './BaseResource/Buffer/FUniformBuffer';
import { FTexture2D } from './BaseResource/Texture/FTexture2D';
import { FTexture3D } from './BaseResource/Texture/FTexture3D';
import { FVertexShader } from './BaseResource/Shader/FVertexShader';
import { FPixelShader } from './BaseResource/Shader/FPixelShader';
import { FComputeShader } from './BaseResource/Shader/FComputeShader';
import { FRenderPipeline } from './BaseResource/Pipeline/FRenderPipeline';
import { FComputePipeline } from './BaseResource/Pipeline/FComputePipeline';
import { FModuleManager } from '../FModuleManager';
import { ViewportCanvas } from '../../UI/Components/MainContent/ViewportCanvas';
/**
 * 资源类型枚举
 * @enum {string}
 */
export const EResourceType = {
    // Buffer类型
    VERTEX_BUFFER: 'vertex-buffer',
    INDEX_BUFFER: 'index-buffer',
    UNIFORM_BUFFER: 'uniform-buffer',
    STORAGE_BUFFER: 'storage-buffer',
    
    // Texture类型
    TEXTURE_2D: 'texture-2d',
    TEXTURE_3D: 'texture-3d',
    TEXTURE_CUBE: 'texture-cube',
    
    // Shader类型
    VERTEX_SHADER: 'vertex-shader',
    FRAGMENT_SHADER: 'fragment-shader',
    COMPUTE_SHADER: 'compute-shader'
};

/**
 * 管线类型枚举
 * @enum {string}
 */
export const EPipelineType = {
    RENDER: 'render',
    COMPUTE: 'compute'
};

/**
 * 资源管理模块
 * 管理所有GPU资源的生命周期
 * 
 * @example
 * // 1. 初始化资源模块
 * ResourceModule.initialize(device);
 * const resourceModule = ResourceModule.getInstance();
 * 
 * // 2. 创建顶点缓冲区
 * resourceModule.createResource(EResourceType.VERTEX_BUFFER, "meshVertices")
 *     .setData(new Float32Array([...]))
 *     .setLayout({
 *         arrayStride: 32,
 *         attributes: [
 *             { // position
 *                 shaderLocation: 0,
 *                 offset: 0,
 *                 format: 'float32x3'
 *             },
 *             { // normal
 *                 shaderLocation: 1,
 *                 offset: 12,
 *                 format: 'float32x3'
 *             },
 *             { // uv
 *                 shaderLocation: 2,
 *                 offset: 24,
 *                 format: 'float32x2'
 *             }
 *         ]
 *     })
 *     .build();
 * 
 * // 3. 创建索引缓冲区
 * resourceModule.createResource(EResourceType.INDEX_BUFFER, "meshIndices")
 *     .setData(new Uint16Array([...]))
 *     .setFormat('uint16')
 *     .build();
 * 
 * // 4. 创建Uniform缓冲区
 * resourceModule.createResource(EResourceType.UNIFORM_BUFFER, "transformUniforms")
 *     .setSize(128)  // mat4x4 (64) + mat4x4 (64)
 *     .build();
 * 
 * resourceModule.createResource(EResourceType.UNIFORM_BUFFER, "materialUniforms")
 *     .setSize(32)   // vec4 (16) + float (4) + float (4) + padding (8)
 *     .build();
 * 
 * // 5. 创建纹理
 * resourceModule.createResource(EResourceType.TEXTURE_2D, "baseColorTexture")
 *     .setFormat("rgba8unorm")
 *     .setSize({ width: 1024, height: 1024 })
 *     .setUsage(GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST)
 *     .build();
 * 
 * // 6. 创建绑定组
 * resourceModule.createBindGroup("transformBindGroup")
 *     .setLayout([
 *         { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: "uniform" }},
 *         { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: "uniform" }}
 *     ])
 *     .setEntries([
 *         { binding: 0, resource: { buffer: "transformUniforms", offset: 0, size: 64 }},
 *         { binding: 1, resource: { buffer: "transformUniforms", offset: 64, size: 64 }}
 *     ])
 *     .build();
 * 
 * resourceModule.createBindGroup("materialBindGroup")
 *     .setLayout([
 *         { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" }},
 *         { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {}},
 *         { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: {}}
 *     ])
 *     .setEntries([
 *         { binding: 0, resource: { buffer: "materialUniforms" }},
 *         { binding: 1, resource: "baseColorTexture" },
 *         { binding: 2, resource: device.createSampler({ magFilter: 'linear' })}
 *     ])
 *     .build();
 * 
 * // 7. 创建着色器
 * resourceModule.createResource(EResourceType.VERTEX_SHADER, "basicVertex")
 *     .setCode(`
 *         struct VertexInput {
 *             @location(0) position: vec3f,
 *             @location(1) normal: vec3f,
 *             @location(2) uv: vec2f,
 *         };
 *         // ... shader code ...
 *     `)
 *     .build();
 * 
 * resourceModule.createResource(EResourceType.FRAGMENT_SHADER, "basicPixel")
 *     .setCode(`
 *         struct MaterialUniforms {
 *             baseColor: vec4f,
 *             roughness: f32,
 *             metallic: f32,
 *         };
 *         // ... shader code ...
 *     `)
 *     .build();
 * 
 * // 8. 创建渲染管线
 * const renderPipeline = resourceModule.createPipeline(EPipelineType.RENDER, "basicRender")
 *     .setVertexShader("basicVertex")
 *     .setVertexBuffer("meshVertices")
 *     .setFragment({
 *         module: "basicPixel",
 *         targets: [{ format: presentationFormat }]
 *     })
 *     .setPrimitive({
 *         topology: 'triangle-list',
 *         cullMode: 'back'
 *     })
 *     .setDepthStencil({
 *         format: 'depth24plus',
 *         depthWriteEnabled: true
 *     })
 *     .addBindGroup("transformBindGroup")
 *     .addBindGroup("materialBindGroup")
 *     .build();
 * 
 * @note
 * 1. 所有资源创建都支持链式调用
 * 2. 创建时只需要提供必要的参数
 * 3. 通过 build() 完成资源创建
 * 4. 资源之间通过名称引用
 * 5. 每种资源都有合理的默认值
 */
export class ResourceModule {
    // 单例实现
    static instance = null;

    /**
     * 初始化资源模块
     * @param {GPUDevice} device - GPU设备
     */
    static initialize(device) {
        if (ResourceModule.instance) {
            throw new Error('ResourceModule already initialized');
        }
        ResourceModule.instance = new ResourceModule(device);
    }

    /**
     * 获取资源模块实例
     * @returns {ResourceModule} 资源模块实例
     */
    static getInstance() {
        if (!ResourceModule.instance) {
            throw new Error('ResourceModule not initialized');
        }
        return ResourceModule.instance;
    }

    /**
     * 销毁资源模块
     */
    static destroy() {
        if (ResourceModule.instance) {
            ResourceModule.instance.removeAll();
            ResourceModule.instance = null;
        }
    }

    /**
     * @private
     * @param {GPUDevice} device - GPU设备
     */
    constructor(device) {
        this.device = device;
        this.canvases = new Map();
        this.resources = new Map();
        this.bindGroups = new Map();
        this.pipelines = new Map();
        this.resizeDependencies = new Map();
    }

    /**
     * 添加画布
     * @param {string} name - 画布名称
     * @param {Object} callbacks - 回调函数
     * @param {Function} callbacks.onReady - 画布就绪回调
     * @param {Function} callbacks.onResize - 画布尺寸改变回调
     */
    addCanvas(name, callbacks = {}) {
        if (this.canvases.has(name)) {
            throw new Error(`Canvas already exists: ${name}`);
        }

        // 获取UI模块和主内容构建器
        const UIModule = FModuleManager.GetInstance().GetModule('UIModule');
        const mainContentBuilder = UIModule.GetMainContentBuilder();

        // 创建画布组件，使用name作为唯一path
        mainContentBuilder.addComponent(
            'viewport',
            name,  // 使用传入的name作为唯一标识符
            <ViewportCanvas
                onCanvasReady={(canvas, context) => {
                    // 保存画布信息
                    this.canvases.set(name, {
                        context,
                        ...callbacks
                    });
                    this.resizeDependencies.set(name, new Set());

                    // 调用就绪回调
                    if (callbacks.onReady) {
                        callbacks.onReady(canvas, context);
                    }
                }}
                onResize={(width, height) => {
                    // 调用尺寸改变回调
                    if (callbacks.onResize) {
                        callbacks.onResize(width, height);
                    }
                    // 处理依赖资源的尺寸改变
                    this.handleCanvasResize(name, width, height);
                }}
                canvasId={name}
            />
        );
    }

    /**
     * 移除画布
     * @param {string} name - 画布名称
     */
    removeCanvas(name) {
        // 从UI系统中移除画布组件
        const UIModule = FModuleManager.GetInstance().GetModule('UIModule');
        const mainContentBuilder = UIModule.GetMainContentBuilder();
        mainContentBuilder.removeComponent('viewport', name);

        // 清理资源管理器中的相关数据
        this.canvases.delete(name);
        this.resizeDependencies.delete(name);
    }

    /**
     * 获取画布上下文
     * @param {string} name - 画布名称
     * @returns {GPUCanvasContext} 画布上下文
     */
    getCanvas(name) {
        // 从UI系统中获取画布元素
        const UIModule = FModuleManager.GetInstance().GetModule('UIModule');
        const mainContentBuilder = UIModule.GetMainContentBuilder();
        const canvas = mainContentBuilder.getComponentElement('viewport', name);
        
        if (!canvas) {
            throw new Error(`Canvas not found: ${name}`);
        }

        // 获取存储的上下文信息
        const canvasInfo = this.canvases.get(name);
        if (!canvasInfo || !canvasInfo.context) {
            throw new Error(`Canvas context not ready: ${name}`);
        }

        return canvasInfo.context;
    }

    /**
     * 配置画布
     * @param {string} name - 画布名称
     * @param {GPUCanvasConfiguration} config - 画布配置
     */
    configureCanvas(name, config) {
        const context = this.getCanvas(name);
        if (!context) {
            throw new Error(`Canvas context not found: ${name}`);
        }
        context.configure(config);
    }

    /**
     * 处理画布尺寸改变
     * @private
     * @param {string} name - 画布名称
     * @param {number} width - 新宽度
     * @param {number} height - 新高度
     */
    handleCanvasResize(name, width, height) {
        const canvasInfo = this.canvases.get(name);
        if (!canvasInfo) return;

        // 调用画布的尺寸改变回调
        if (canvasInfo.onResize) {
            canvasInfo.onResize(width, height);
        }

        // 更新依赖资源
        const dependents = this.resizeDependencies.get(name);
        if (dependents) {
            for (const resourceName of dependents) {
                const resource = this.getResource(resourceName);
                if (resource && typeof resource.resize === 'function') {
                    resource.resize({ width, height });
                }
            }
        }
    }

    /**
     * 添加画布尺寸依赖
     * @param {string} canvasName - 画布名称
     * @param {string} resourceName - 资源名称
     */
    addResizeDependent(canvasName, resourceName) {
        const dependents = this.resizeDependencies.get(canvasName);
        if (!dependents) {
            throw new Error(`Canvas not found: ${canvasName}`);
        }
        dependents.add(resourceName);
    }

    /**
     * 移除画布尺寸依赖
     * @param {string} canvasName - 画布名称
     * @param {string} resourceName - 资源名称
     */
    removeResizeDependent(canvasName, resourceName) {
        const dependents = this.resizeDependencies.get(canvasName);
        if (dependents) {
            dependents.delete(resourceName);
        }
    }

    /**
     * 创建资源
     * @param {EResourceType} type - 资源类型
     * @param {string} name - 资源名称
     * @returns {FResource} 创建的资源
     */
    createResource(type, name) {
        if (this.resources.has(name)) {
            throw new Error(`Resource already exists: ${name}`);
        }

        const resource = this.createResourceByType(type, { name });
        this.resources.set(name, resource);
        return resource;
    }

    /**
     * 获取资源
     * @param {string} name - 资源名称
     * @returns {FResource} 资源对象
     */
    getResource(name) {
        const resource = this.resources.get(name);
        if (!resource) {
            throw new Error(`Resource not found: ${name}`);
        }
        return resource;
    }

    /**
     * 移除资源
     * @param {string} name - 资源名称
     */
    removeResource(name) {
        const resource = this.resources.get(name);
        if (resource) {
            resource.destroy();
            this.resources.delete(name);
        }
    }

    /**
     * 创建绑定组
     * @param {string} name - 绑定组名称
     * @param {Object} desc - 绑定组描述符
     * @returns {FBindGroup} 创建的绑定组
     */
    createBindGroup(name, desc) {
        if (this.bindGroups.has(name)) {
            throw new Error(`BindGroup already exists: ${name}`);
        }

        const bindGroup = new FBindGroup(this.device, { ...desc, name });
        this.bindGroups.set(name, bindGroup);
        return bindGroup;
    }

    /**
     * 获取绑定组
     * @param {string} name - 绑定组名称
     * @returns {FBindGroup} 绑定组对象
     */
    getBindGroup(name) {
        const bindGroup = this.bindGroups.get(name);
        if (!bindGroup) {
            throw new Error(`BindGroup not found: ${name}`);
        }
        return bindGroup;
    }

    /**
     * 移除绑定组
     * @param {string} name - 绑定组名称
     */
    removeBindGroup(name) {
        const bindGroup = this.bindGroups.get(name);
        if (bindGroup) {
            bindGroup.destroy();
            this.bindGroups.delete(name);
        }
    }

    /**
     * 创建管线
     * @param {EPipelineType} type - 管线类型
     * @param {string} name - 管线名称
     * @returns {FPipeline} 创建的管线
     */
    createPipeline(type, name) {
        if (this.pipelines.has(name)) {
            throw new Error(`Pipeline already exists: ${name}`);
        }

        const pipeline = this.createPipelineByType(type, { name });
        this.pipelines.set(name, pipeline);
        return pipeline;
    }

    /**
     * 获取管线
     * @param {string} name - 管线名称
     * @returns {FPipeline} 管线对象
     */
    getPipeline(name) {
        const pipeline = this.pipelines.get(name);
        if (!pipeline) {
            throw new Error(`Pipeline not found: ${name}`);
        }
        return pipeline;
    }

    /**
     * 移除管线
     * @param {string} name - 管线名称
     */
    removePipeline(name) {
        const pipeline = this.pipelines.get(name);
        if (pipeline) {
            pipeline.destroy();
            this.pipelines.delete(name);
        }
    }

    /**
     * 移除所有资源
     */
    removeAll() {
        // 从UI系统中移除所有画布
        const UIModule = FModuleManager.GetInstance().GetModule('UIModule');
        const mainContentBuilder = UIModule.GetMainContentBuilder();
        
        // 清理所有画布组件
        for (const name of this.canvases.keys()) {
            mainContentBuilder.removeComponent('viewport', name);
        }

        // 清理其他资源
        this.removeAllPipelines();
        this.removeAllBindGroups();
        this.removeAllResources();
        this.canvases.clear();
        this.resizeDependencies.clear();
    }

    /**
     * 移除所有资源（不包括绑定组和管线）
     */
    removeAllResources() {
        for (const resource of this.resources.values()) {
            resource.destroy();
        }
        this.resources.clear();
    }

    /**
     * 移除所有绑定组
     */
    removeAllBindGroups() {
        for (const bindGroup of this.bindGroups.values()) {
            bindGroup.destroy();
        }
        this.bindGroups.clear();
    }

    /**
     * 移除所有管线
     */
    removeAllPipelines() {
        for (const pipeline of this.pipelines.values()) {
            pipeline.destroy();
        }
        this.pipelines.clear();
    }

    /**
     * @private
     * 根据类型创建资源
     * @param {EResourceType} type - 资源类型
     * @param {Object} desc - 资源描述符
     * @returns {FResource} 创建的资源
     */
    createResourceByType(type, desc) {
        switch (type) {
            // Buffer资源
            case EResourceType.VERTEX_BUFFER:
                return new FVertexBuffer(this.device, desc);
                
            case EResourceType.INDEX_BUFFER:
                return new FIndexBuffer(this.device, desc);
                
            case EResourceType.UNIFORM_BUFFER:
                return new FUniformBuffer(this.device, desc);
                
            case EResourceType.STORAGE_BUFFER:
                return new FUniformBuffer(this.device, {
                    ...desc,
                    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
                });

            // Texture资源
            case EResourceType.TEXTURE_2D:
                return new FTexture2D(this.device, desc);
                
            case EResourceType.TEXTURE_3D:
                return new FTexture3D(this.device, desc);
                
            case EResourceType.TEXTURE_CUBE:
                // TODO: 实现立方体纹理
                throw new Error('Cube texture not implemented yet');

            // Shader资源
            case EResourceType.VERTEX_SHADER:
                return new FVertexShader(this.device, desc);
                
            case EResourceType.FRAGMENT_SHADER:
                return new FPixelShader(this.device, desc);
                
            case EResourceType.COMPUTE_SHADER:
                return new FComputeShader(this.device, desc);

            default:
                throw new Error(`Unknown resource type: ${type}`);
        }
    }

    /**
     * @private
     * 根据类型创建管线
     * @param {EPipelineType} type - 管线类型
     * @param {Object} desc - 管线描述符
     * @returns {FPipeline} 创建的管线
     */
    createPipelineByType(type, desc) {
        switch (type) {
            case EPipelineType.RENDER:
                return new FRenderPipeline(this.device, desc);
                
            case EPipelineType.COMPUTE:
                return new FComputePipeline(this.device, desc);
                
            default:
                throw new Error(`Unknown pipeline type: ${type}`);
        }
    }

    /**
     * 添加已有的Buffer到资源管理器
     * @param {string} name - Buffer名称
     * @param {GPUBuffer} buffer - GPU Buffer对象
     * @param {Object} desc - Buffer描述
     * @param {EResourceType} desc.type - Buffer类型
     * @param {Object} [desc.layout] - 顶点缓冲区布局(仅顶点缓冲区需要)
     * @param {number} [desc.layout.arrayStride] - 顶点数据步长
     * @param {Array<GPUVertexAttribute>} [desc.layout.attributes] - 顶点属性
     * @param {string} [desc.format] - 索引缓冲区格式(仅索引缓冲区需要)
     * @returns {FBuffer} 包装后的Buffer资源
     */
    addBuffer(name, buffer, desc) {
        if (this.resources.has(name)) {
            throw new Error(`Resource already exists: ${name}`);
        }

        let resource;
        switch (desc.type) {
            case EResourceType.VERTEX_BUFFER:
                resource = new FVertexBuffer(this.device, {
                    name,
                    gpuBuffer: buffer,
                    layout: desc.layout
                });
                break;

            case EResourceType.INDEX_BUFFER:
                resource = new FIndexBuffer(this.device, {
                    name,
                    gpuBuffer: buffer,
                    format: desc.format
                });
                break;

            case EResourceType.UNIFORM_BUFFER:
            case EResourceType.STORAGE_BUFFER:
                resource = new FUniformBuffer(this.device, {
                    name,
                    gpuBuffer: buffer,
                    usage: desc.type === EResourceType.STORAGE_BUFFER
                        ? GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
                        : GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
                });
                break;

            default:
                throw new Error(`Invalid buffer type: ${desc.type}`);
        }

        this.resources.set(name, resource);
        return resource;
    }
} 