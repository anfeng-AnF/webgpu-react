import IModule from '../Core/IModule';
import React from 'react';
import FModuleManager from '../Core/FModuleManager';
import ViewportCanvas from '../UI/Components/MainContent/ViewportCanvas';
import { FResourceModule } from '../Resources/FResourceModule';
import { EBufferUsage } from '../Resources/BaseResource/Buffer/FBuffer';
import { EVertexFormat } from '../Resources/BaseResource/Buffer/FVertexBuffer';

/**
 * 渲染器模块
 */
class RendererModule extends IModule {
    constructor(Config) {
        super();
        this.canvas = null;
        this.device = null;
        this.context = null;
        this.resourceModule = null;
        
        // 渲染资源
        this.vertexBuffer = null;
        this.pipeline = null;
        this.bindGroup = null;
        
        // 初始化标志
        this.bResourcesInitialized = false;
    }

    /**
     * 初始化WebGPU
     * @private
     */
    async _initializeWebGPU() {
        if (!navigator.gpu) {
            throw new Error('WebGPU not supported');
        }
        
        this.device = this.resourceModule.GetDevice();
        
        
        this.context = this.canvas.getContext('webgpu');
        const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
        
        this.context.configure({
            device: this.device,
            format: canvasFormat,
            alphaMode: 'premultiplied',
        });
    }

    /**
     * 创建渲染资源
     * @private
     */
    async _createRenderResources() {
        // 顶点数据 - 一个三角形
        const vertices = new Float32Array([
            0.0,  0.5, 0.0,  1.0, 0.0, 0.0, // 顶部顶点 (红色)
           -0.5, -0.5, 0.0,  0.0, 1.0, 0.0, // 左下顶点 (绿色)
            0.5, -0.5, 0.0,  0.0, 0.0, 1.0  // 右下顶点 (蓝色)
        ]);

        // 创建顶点缓冲区
        this.vertexBuffer = this.resourceModule.CreateVertexBuffer({
            name: 'TriangleVertexBuffer',
            size: vertices.byteLength,
            stride: 24, // 6 * float32 (3 position + 3 color)
            attributes: [
                {
                    name: 'position',
                    format: EVertexFormat.FLOAT32X3,
                    offset: 0
                },
                {
                    name: 'color',
                    format: EVertexFormat.FLOAT32X3,
                    offset: 12
                }
            ],
            usage: EBufferUsage.VERTEX | EBufferUsage.COPY_DST, // 只使用必要的标志位
            initialData: vertices
        });
        // 创建着色器
        const shader = `
            struct VertexOutput {
                @builtin(position) position: vec4f,
                @location(0) color: vec4f,
            }

            @vertex
            fn vertexMain(@location(0) position: vec3f,
                         @location(1) color: vec3f) -> VertexOutput {
                var output: VertexOutput;
                output.position = vec4f(position, 1.0);
                output.color = vec4f(color, 1.0);
                return output;
            }

            @fragment
            fn fragmentMain(@location(0) color: vec4f) -> @location(0) vec4f {
                return color;
            }
        `;

        // 创建渲染管线
        this.pipeline = this.resourceModule.CreateGraphicsPipeline({
            name: 'TrianglePipeline',
            layout: {
                bindGroupLayouts: [] // 这个简单示例不需要绑定组
            },
            graphics: {
                vertexShader: shader,
                fragmentShader: shader,
                vertexBuffers: [this.vertexBuffer],
                colorTargets: [{
                    format: navigator.gpu.getPreferredCanvasFormat()
                }],
                topology: 'triangle-list'
            }
        });

        // 在所有资源创建完成后设置标志
        this.bResourcesInitialized = true;
    }

    /**
     * 渲染一帧
     * @private
     */
    _render() {
        // 创建命令编码器
        const commandEncoder = this.device.createCommandEncoder();
        
        // 获取当前纹理视图
        const textureView = this.context.getCurrentTexture().createView();
        
        // 创建渲染通道
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                clearValue: { r: 0.1, g: 0.2, b: 0.3, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store'
            }]
        });

        // 设置渲染管线
        renderPass.setPipeline(this.pipeline.getGPUPipeline());
        
        // 设置顶点缓冲区
        renderPass.setVertexBuffer(0, this.vertexBuffer.getGPUBuffer());
        
        // 绘制三角形
        renderPass.draw(3, 1, 0, 0);
        
        // 结束渲染通道
        renderPass.end();
        
        // 提交命令
        this.device.queue.submit([commandEncoder.finish()]);
    }

    /**
     * 初始化模块
     * @returns {Promise<void>}
     */
    async Initialize() {
        if (this.bInitialized) {
            console.warn('RendererModule already initialized');
            return;
        }

        try {
            const handleCanvasReady = async (canvas) => {
                this.canvas = canvas;
                
                // 初始化WebGPU
                await this._initializeWebGPU();
                
                // 获取资源模块
                this.resourceModule = FResourceModule.Get();
                
                // 创建渲染资源
                await this._createRenderResources();
            };

            const handleCanvasResize = (canvas) => {
                // 处理画布大小变化
                if (this.context) {
                    this.context.configure({
                        device: this.device,
                        format: navigator.gpu.getPreferredCanvasFormat(),
                        alphaMode: 'premultiplied',
                    });
                }
            };

            const UIModel = FModuleManager.GetInstance().GetModule('UIModule');
            const mainContentBuilder = UIModel.GetMainContentBuilder();
            this.resourceModule = FResourceModule.Get();

            // 添加 ViewportCanvas
            mainContentBuilder.addComponent(
                'viewport',
                'ViewportCanvas2',
                <ViewportCanvas
                    onCanvasReady={handleCanvasReady}
                    onResize={handleCanvasResize}
                    canvasId="Normal"
                />
            );

        } catch (Error) {
            console.error('Failed to initialize RendererModule:', Error);
            throw Error;
        }
    }

    /**
     * 更新模块
     * @param {number} DeltaTime - 时间增量（秒）
     */
    Update(DeltaTime) {
        if (this.device && this.context && this.bResourcesInitialized) {
            this._render();
        }
    }

    /**
     * 关闭模块
     * @returns {Promise<void>}
     */
    async Shutdown() {
        if (!this.bInitialized) return;

        try {
            // 清理资源
            if (this.vertexBuffer) {
                this.resourceModule.Release(this.vertexBuffer);
            }
            if (this.pipeline) {
                this.resourceModule.Release(this.pipeline);
            }
            
            this.device = null;
            this.context = null;
            this.bResourcesInitialized = false;
            console.log('RendererModule shut down');
        } catch (error) {
            console.error('Error during RendererModule shutdown:', error);
            throw error;
        }
    }
}

export default RendererModule;
