import { FPipeline, EPipelineType } from './FPipeline';

/**
 * 渲染管线类
 * 
 * @example
 * // 1. 创建并配置渲染管线
 * const pipeline = new FRenderPipeline(device, "basicRender")
 *     .setVertexShader("standardVertex")    // 使用资源名称引用着色器
 *     .setVertexBuffer("meshVertexBuffer")  // 使用资源名称引用顶点缓冲区
 *     .setFragment({
 *         module: pixelShader.getResource(),
 *         targets: [{
 *             format: presentationFormat,
 *             blend: {
 *                 color: {
 *                     srcFactor: 'src-alpha',
 *                     dstFactor: 'one-minus-src-alpha'
 *                 },
 *                 alpha: {
 *                     srcFactor: 'one',
 *                     dstFactor: 'one-minus-src-alpha'
 *                 }
 *             }
 *         }]
 *     })
 *     .setPrimitive({
 *         topology: 'triangle-list',
 *         cullMode: 'back',
 *         frontFace: 'ccw'
 *     })
 *     .setDepthStencil({
 *         format: 'depth24plus',
 *         depthWriteEnabled: true,
 *         depthCompare: 'less'
 *     })
 *     .setMultisample({
 *         count: 4,
 *         mask: 0xFFFFFFFF,
 *         alphaToCoverageEnabled: false
 *     })
 *     .addBindGroup("transformBindGroup")
 *     .addBindGroup("materialBindGroup")
 *     .build();
 * 
 * // 2. 在渲染通道中使用
 * const commandEncoder = device.createCommandEncoder();
 * const renderPass = commandEncoder.beginRenderPass({
 *     colorAttachments: [{
 *         view: context.getCurrentTexture().createView(),
 *         clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
 *         loadOp: 'clear',
 *         storeOp: 'store'
 *     }],
 *     depthStencilAttachment: {
 *         view: depthTexture.createView(),
 *         depthClearValue: 1.0,
 *         depthLoadOp: 'clear',
 *         depthStoreOp: 'store'
 *     }
 * });
 * 
 * // 设置管线和资源
 * renderPass.setPipeline(pipeline.getResource());
 * renderPass.setBindGroup(0, transformBindGroup);  // 变换矩阵绑定组
 * renderPass.setBindGroup(1, materialBindGroup);   // 材质参数绑定组
 * 
 * // 设置顶点和索引数据
 * renderPass.setVertexBuffer(0, vertexBuffer);
 * renderPass.setIndexBuffer(indexBuffer, 'uint16');
 * 
 * // 绘制命令
 * renderPass.drawIndexed(indexCount, instanceCount, firstIndex, baseVertex, firstInstance);
 * // 或者不使用索引的绘制
 * renderPass.draw(vertexCount, instanceCount, firstVertex, firstInstance);
 * 
 * renderPass.end();
 * device.queue.submit([commandEncoder.finish()]);
 * 
 * @note
 * 1. 使用链式调用配置管线状态
 * 2. 默认入口点：顶点着色器"VertexMain"，像素着色器"PixelMain"
 * 3. 必须调用build()完成管线创建
 * 4. 绑定组通过名称引用，实际布局由资源系统提供
 * 5. 所有状态设置方法都有合理的默认值
 * 6. 渲染通道中的资源设置顺序必须与管线布局匹配
 * 7. 支持索引绘制和非索引绘制两种方式
 */
export class FRenderPipeline extends FPipeline {
    /**
     * @param {GPUDevice} device - GPU设备
     * @param {string} name - 管线名称
     */
    constructor(device, name) {
        super(device, {
            name,
            type: EPipelineType.RENDER
        });

        this.vertexShaderName = null;
        this.vertexBufferName = null;
        this.vertexEntryPoint = "VertexMain";
        this.fragmentState = null;
        this.primitiveState = null;
        this.depthStencilState = null;
        this.multisampleState = null;
        this.bindGroupNames = [];
        this.isBuilt = false;
    }

    /**
     * 设置顶点着色器
     * @param {string} shaderName - 顶点着色器资源名称
     * @param {string} [entryPoint="VertexMain"] - 入口点
     * @returns {FRenderPipeline} this
     */
    setVertexShader(shaderName, entryPoint = "VertexMain") {
        this.vertexShaderName = shaderName;
        this.vertexEntryPoint = entryPoint;
        return this;
    }

    /**
     * 设置顶点缓冲区
     * @param {string} bufferName - 顶点缓冲区资源名称
     * @returns {FRenderPipeline} this
     */
    setVertexBuffer(bufferName) {
        this.vertexBufferName = bufferName;
        return this;
    }

    /**
     * 设置像素着色器状态
     * @param {Object} state - 像素着色器配置
     * @param {GPUShaderModule} state.module - 像素着色器模块
     * @param {string} [state.entryPoint="PixelMain"] - 入口点
     * @param {Array<GPUColorTargetState>} state.targets - 渲染目标配置
     * @returns {FRenderPipeline} this
     */
    setFragment(state) {
        this.fragmentState = {
            ...state,
            entryPoint: state.entryPoint || "PixelMain"
        };
        return this;
    }

    /**
     * 设置图元状态
     * @param {Object} state - 图元配置
     * @param {GPUPrimitiveTopology} [state.topology='triangle-list'] - 图元类型
     * @param {GPUCullMode} [state.cullMode='none'] - 面剔除模式
     * @param {GPUFrontFace} [state.frontFace='ccw'] - 正面定义
     * @returns {FRenderPipeline} this
     */
    setPrimitive(state) {
        this.primitiveState = {
            topology: 'triangle-list',
            cullMode: 'none',
            frontFace: 'ccw',
            ...state
        };
        return this;
    }

    /**
     * 设置深度模板状态
     * @param {Object} state - 深度模板配置
     * @param {GPUTextureFormat} state.format - 深度模板格式
     * @param {boolean} [state.depthWriteEnabled=true] - 深度写入
     * @param {GPUCompareFunction} [state.depthCompare='less'] - 深度比较函数
     * @returns {FRenderPipeline} this
     */
    setDepthStencil(state) {
        this.depthStencilState = {
            depthWriteEnabled: true,
            depthCompare: 'less',
            ...state
        };
        return this;
    }

    /**
     * 设置多重采样状态
     * @param {Object} state - 多重采样配置
     * @param {number} [state.count=1] - 采样数
     * @param {number} [state.mask=0xFFFFFFFF] - 采样掩码
     * @param {boolean} [state.alphaToCoverageEnabled=false] - alpha to coverage
     * @returns {FRenderPipeline} this
     */
    setMultisample(state) {
        this.multisampleState = {
            count: 1,
            mask: 0xFFFFFFFF,
            alphaToCoverageEnabled: false,
            ...state
        };
        return this;
    }

    /**
     * 添加绑定组
     * @param {string} name - 绑定组名称
     * @returns {FRenderPipeline} this
     */
    addBindGroup(name) {
        this.bindGroupNames.push(name);
        return this;
    }

    /**
     * 构建管线
     * @returns {FRenderPipeline} this
     * @throws {Error} 如果缺少必要配置
     */
    build() {
        if (!this.vertexShaderName) {
            throw new Error('Vertex shader is required');
        }
        if (!this.vertexBufferName) {
            throw new Error('Vertex buffer is required');
        }
        if (!this.fragmentState) {
            throw new Error('Fragment state is required');
        }

        // 从资源系统获取着色器和缓冲区
        const vertexShader = this.resourceModule.getShader(this.vertexShaderName);
        const vertexBuffer = this.resourceModule.getBuffer(this.vertexBufferName);

        // 构建顶点状态
        this.vertexState = {
            module: vertexShader.getResource(),
            entryPoint: this.vertexEntryPoint,
            buffers: [vertexBuffer.getLayout()]
        };

        // 从资源系统获取绑定组布局
        this.bindGroupLayouts = this.bindGroupNames.map(name => 
            this.resourceModule.getBindGroupLayout(name)
        );

        this.create();
        this.isBuilt = true;
        return this;
    }

    /**
     * 创建渲染管线
     * @protected
     */
    create() {
        this.gpuResource = this.device.createRenderPipeline({
            layout: this.getLayout(),
            vertex: this.vertexState,
            fragment: this.fragmentState,
            primitive: this.primitiveState || { topology: 'triangle-list' },
            depthStencil: this.depthStencilState,
            multisample: this.multisampleState
        });
    }

    /**
     * 获取资源
     * @returns {GPURenderPipeline} 渲染管线
     * @throws {Error} 如果管线未构建
     */
    getResource() {
        if (!this.isBuilt) {
            throw new Error('Pipeline must be built before use');
        }
        return super.getResource();
    }
} 