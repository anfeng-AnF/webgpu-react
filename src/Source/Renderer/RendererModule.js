import IModule from '../Core/IModule';
import React from 'react';
import FModuleManager from '../Core/FModuleManager';
import ViewportCanvas from '../UI/Components/MainContent/ViewportCanvas';
import { FResourceModule } from '../Resources/FResourceModule';
import { EBufferUsage } from '../Resources/BaseResource/Buffer/FBuffer';
import { EVertexFormat } from '../Resources/BaseResource/Buffer/FVertexBuffer';
import TempCamera from './TempCamera';
import { ETexture2DUsage } from '../Resources/BaseResource/Textures/FTexture2D';
import { mat4 } from 'gl-matrix';
import { FBindGroupLayout, FBindGroup } from '../Resources/BaseResource/BindGroup/FBindGroup';
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
        this.indexBuffer = null;
        this.uniformBuffer = null;
        this.pipeline = null;
        this.bindGroupLayout = null;
        this.bindGroup = null;
        
        // 初始化标志
        this.bResourcesInitialized = false;

        //测试使用的摄像机
        this.camera = new TempCamera();
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
        if (this.bResourcesInitialized) {
            console.warn('RendererModule: Resources already initialized');
            return;
        }

        // 立方体的顶点数据 (位置 + 颜色)
        const vertices = new Float32Array([
            // 前面 (红色)
            -0.5, -0.5,  0.5,  1.0, 0.0, 0.0,
             0.5, -0.5,  0.5,  1.0, 0.0, 0.0,
             0.5,  0.5,  0.5,  1.0, 0.0, 0.0,
            -0.5,  0.5,  0.5,  1.0, 0.0, 0.0,
            
            // 后面 (绿色)
            -0.5, -0.5, -0.5,  0.0, 1.0, 0.0,
            -0.5,  0.5, -0.5,  0.0, 1.0, 0.0,
             0.5,  0.5, -0.5,  0.0, 1.0, 0.0,
             0.5, -0.5, -0.5,  0.0, 1.0, 0.0,
            
            // 上面 (蓝色)
            -0.5,  0.5,  0.5,  0.0, 0.0, 1.0,
             0.5,  0.5,  0.5,  0.0, 0.0, 1.0,
             0.5,  0.5, -0.5,  0.0, 0.0, 1.0,
            -0.5,  0.5, -0.5,  0.0, 0.0, 1.0,
            
            // 下面 (黄色)
            -0.5, -0.5, -0.5,  1.0, 1.0, 0.0,
            -0.5, -0.5,  0.5,  1.0, 1.0, 0.0,
             0.5, -0.5,  0.5,  1.0, 1.0, 0.0,
             0.5, -0.5, -0.5,  1.0, 1.0, 0.0,
            
            // 右面 (紫色)
             0.5, -0.5,  0.5,  1.0, 0.0, 1.0,
             0.5,  0.5,  0.5,  1.0, 0.0, 1.0,
             0.5,  0.5, -0.5,  1.0, 0.0, 1.0,
             0.5, -0.5, -0.5,  1.0, 0.0, 1.0,
            
            // 左面 (青色)
            -0.5, -0.5, -0.5,  0.0, 1.0, 1.0,
            -0.5, -0.5,  0.5,  0.0, 1.0, 1.0,
            -0.5,  0.5,  0.5,  0.0, 1.0, 1.0,
            -0.5,  0.5, -0.5,  0.0, 1.0, 1.0,
        ]);

        // 立方体的索引数据
        const indices = new Uint16Array([
            0,  1,  2,  2,  3,  0,  // 前面
            4,  5,  6,  6,  7,  4,  // 后面
            8,  9,  10, 10, 11, 8,  // 上面
            12, 13, 14, 14, 15, 12, // 下面
            16, 17, 18, 18, 19, 16, // 右面
            20, 21, 22, 22, 23, 20  // 左面
        ]);

        // 创建顶点缓冲区
        this.vertexBuffer = this.resourceModule.CreateVertexBuffer({
            name: 'CubeVertexBuffer',
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
            usage: EBufferUsage.VERTEX | EBufferUsage.COPY_DST,
            initialData: vertices
        });

        // 创建索引缓冲区
        this.indexBuffer = this.resourceModule.CreateIndexBuffer({
            name: 'CubeIndexBuffer',
            size: indices.byteLength,
            usage: EBufferUsage.INDEX | EBufferUsage.COPY_DST,
            initialData: indices
        });

        // 创建 MVP 矩阵的 Uniform Buffer
        this.uniformBuffer = this.resourceModule.CreateUniformBuffer({
            name: 'CubeMVPBuffer',
            size: 4 * 16 * 3, // 3个4x4矩阵
            usage: EBufferUsage.UNIFORM | EBufferUsage.COPY_DST
        });

        // 设置绑定位置
        this.uniformBuffer.setBindingLocation(0, 0);

        // 直接创建绑定组布局
        this.bindGroupLayout = new FBindGroupLayout(this.device, {
            name: 'CubeBindGroupLayout',
            entries: [
                this.uniformBuffer.getBindGroupLayoutEntry()
            ]
        });

        // 直接创建绑定组
        this.bindGroup = new FBindGroup(this.device, {
            name: 'CubeBindGroup',
            layout: this.bindGroupLayout,
            entries: [
                this.uniformBuffer.getBindGroupEntry()
            ]
        });

        // 修改着色器代码
        const shader = `
            struct Uniforms {
                modelMatrix : mat4x4f,
                viewMatrix : mat4x4f,
                projectionMatrix : mat4x4f,
            };
            @binding(0) @group(0) var<uniform> uniforms : Uniforms;

            struct VertexOutput {
                @builtin(position) position : vec4f,
                @location(0) color : vec4f,
            }

            @vertex
            fn vertexMain(
                @location(0) position : vec3f,
                @location(1) color : vec3f
            ) -> VertexOutput {
                var output : VertexOutput;
                output.position = uniforms.projectionMatrix * uniforms.viewMatrix * uniforms.modelMatrix * vec4f(position, 1.0);
                output.color = vec4f(color, 1.0);
                return output;
            }

            @fragment
            fn fragmentMain(@location(0) color : vec4f) -> @location(0) vec4f {
                return color;
            }
        `;

        // 创建渲染管线
        this.pipeline = this.resourceModule.CreateGraphicsPipeline({
            name: 'CubePipeline',
            layout: {
                bindGroupLayouts: [this.bindGroupLayout]
            },
            graphics: {
                vertexShader: shader,
                fragmentShader: shader,
                vertexBuffers: [this.vertexBuffer],
                colorTargets: [{
                    format: navigator.gpu.getPreferredCanvasFormat()
                }],
                topology: 'triangle-list',
                cullMode: 'none',
                depthStencil: {
                    format: 'depth24plus',
                    depthWriteEnabled: true,
                    depthCompare: 'less'
                }
            }
        });

        this.bResourcesInitialized = true;

        let texture = this.resourceModule.CreateTexture2D({
            name: 'TestTexture',
            width: 1024,
            height: 1024,
            format: 'rgba8unorm',
            usage: ETexture2DUsage.STORAGE_BINDING
        });
        console.log(texture.GetGPUResource());
        console.log(texture.GetView());
        texture.ResizeTo(512, 512);
        console.log(texture.GetGPUResource());
        console.log(texture.GetView());

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
        
        // 创建深度纹理
        const depthTexture = this.device.createTexture({
            size: {
                width: this.canvas.width,
                height: this.canvas.height,
                depthOrArrayLayers: 1
            },
            format: 'depth24plus',
            usage: GPUTextureUsage.RENDER_ATTACHMENT
        });

        // 更新 MVP 矩阵
        const modelMatrix = mat4.create();
        mat4.rotateY(modelMatrix, modelMatrix, performance.now() / 1000);
        
        const viewMatrix = this.camera.GetViewMatrix();
        const projectionMatrix = this.camera.GetProjectionMatrix();

        // 更新 Uniform Buffer
        this.device.queue.writeBuffer(this.uniformBuffer.getGPUBuffer(), 0, modelMatrix);
        this.device.queue.writeBuffer(this.uniformBuffer.getGPUBuffer(), 64, viewMatrix);
        this.device.queue.writeBuffer(this.uniformBuffer.getGPUBuffer(), 128, projectionMatrix);
        
        // 创建渲染通道
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                clearValue: { r: 0.1, g: 0.2, b: 0.3, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store'
            }],
            depthStencilAttachment: {
                view: depthTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store'
            }
        });

        // 设置渲染管线
        renderPass.setPipeline(this.pipeline.getGPUPipeline());
        renderPass.setBindGroup(0, this.bindGroup.getGPUBindGroup());
        renderPass.setVertexBuffer(0, this.vertexBuffer.getGPUBuffer());
        renderPass.setIndexBuffer(this.indexBuffer.getGPUBuffer(), 'uint16');
        
        // 绘制立方体
        renderPass.drawIndexed(36);
        
        // 结束渲染通道
        renderPass.end();
        
        // 提交命令
        this.device.queue.submit([commandEncoder.finish()]);

        // 销毁深度纹理
        depthTexture.destroy();
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

                console.log(canvas);

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

            const detailBuilder = UIModel.GetDetailBuilder();
            this.camera.SetName('渲染模块摄像机');
            this.camera.AddToDetailBuilder(detailBuilder);


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
            if (this.indexBuffer) {
                this.resourceModule.Release(this.indexBuffer);
            }
            if (this.uniformBuffer) {
                this.resourceModule.Release(this.uniformBuffer);
            }
            if (this.pipeline) {
                this.resourceModule.Release(this.pipeline);
            }
            if (this.bindGroup) {
                this.bindGroup.destroy();
            }
            if (this.bindGroupLayout) {
                this.bindGroupLayout.destroy();
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
