import { PerspectiveCamera, Matrix4, Vector3 } from 'three';
import FResourceManager,{EResourceType} from '../../Core/Resource/FResourceManager';
import FCopyToCanvasPass from '../Pass/FCopyToCanvasPass';
class TestRenderer {
    constructor() {
        /** @type {GPUDevice} */
        this.device = null;
        /** @type {GPUCanvasContext} */
        this.context = null;
        /** @type {HTMLCanvasElement} */
        this.canvas = null;
        
        // 渲染管线和资源
        /** @type {GPURenderPipeline} */
        this.pipeline = null;
        /** @type {GPUBuffer} */
        this.vertexBuffer = null;
        /** @type {GPUBuffer} */
        this.indexBuffer = null;
        /** @type {GPUBuffer} */
        this.uniformBuffer = null;
        /** @type {GPUBindGroup} */
        this.bindGroup = null;

        /** @type {GPUTexture} */
        this.depthTexture = null;
        /** @type {string} */
        this.depthTextureName = 'TestRendererDepthTexture';

        // 添加相机和变换相关属性
        /** @type {PerspectiveCamera} */
        this.camera = null;
        /** @type {Matrix4} */
        this.modelMatrix = new Matrix4();
        /** @type {number} */
        this.rotationAngle = 0;

        this.resourceManager = FResourceManager.GetInstance();

        this.FCopyToCanvasPass = null;

        this.colorAttachmentsName = 'TestColorAttachmentsName'
    }

    async Initialize(device) {
        this.device = device;

        // 初始化相机
        this.camera = new PerspectiveCamera(
            45,                                     // FOV
            window.innerWidth / window.innerHeight, // 初始宽高比
            0.1,                                    // 近平面
            100.0                                   // 远平面
        );
        
        // 设置相机位置和朝向
        this.camera.position.set(0, 2, 8);
        this.camera.lookAt(new Vector3(0, 0, 0));
        
        // 设置模型矩阵（将物体放置在原点附近）
        this.modelMatrix.setPosition(0, 0, 0);

        await this.createPipelineAndResources();

        
    }

    async InitCanvas(canvas) {
        this.canvas = canvas;
        this.context = canvas.getContext('webgpu');
        
        // 配置 Canvas
        this.context.configure({
            device: this.device,
            format: 'bgra8unorm',
            usage: GPUTextureUsage.RENDER_ATTACHMENT
        });
        this.FCopyToCanvasPass = new FCopyToCanvasPass(this.context,canvas.width,canvas.height);
        this.FCopyToCanvasPass.OnCanvasResize(canvas.width, canvas.height, this.context);
        await this.FCopyToCanvasPass.Initialize(canvas.width,canvas.height);
        await this.FCopyToCanvasPass.SetSourceTexture(this.depthTextureName);
        
        // 创建深度纹理
        await this.createDepthTexture(canvas.width, canvas.height);
    }

    async createPipelineAndResources() {
        // 创建顶点缓冲区 - 添加颜色属性
        const vertices = new Float32Array([
            // 位置(x,y,z)    颜色(r,g,b)
            // 前面 (红色) - 逆时针
            -1, -1,  1,     1, 0, 0,  // 左下
             1, -1,  1,     1, 0, 0,  // 右下
             1,  1,  1,     1, 0, 0,  // 右上
            -1,  1,  1,     1, 0, 0,  // 左上
            
            // 后面 (绿色) - 逆时针 (从后面看)
             1, -1, -1,     0, 1, 0,  // 右下
            -1, -1, -1,     0, 1, 0,  // 左下
            -1,  1, -1,     0, 1, 0,  // 左上
             1,  1, -1,     0, 1, 0,  // 右上
            
            // 右面 (蓝色) - 逆时针
             1, -1,  1,     0, 0, 1,  // 前下
             1, -1, -1,     0, 0, 1,  // 后下
             1,  1, -1,     0, 0, 1,  // 后上
             1,  1,  1,     0, 0, 1,  // 前上
            
            // 左面 (黄色) - 逆时针
            -1, -1, -1,     1, 1, 0,  // 后下
            -1, -1,  1,     1, 1, 0,  // 前下
            -1,  1,  1,     1, 1, 0,  // 前上
            -1,  1, -1,     1, 1, 0,  // 后上
            
            // 上面 (青色) - 逆时针
            -1,  1,  1,     0, 1, 1,  // 前左
             1,  1,  1,     0, 1, 1,  // 前右
             1,  1, -1,     0, 1, 1,  // 后右
            -1,  1, -1,     0, 1, 1,  // 后左
            
            // 下面 (品红) - 逆时针
            -1, -1, -1,     1, 0, 1,  // 后左
             1, -1, -1,     1, 0, 1,  // 后右
             1, -1,  1,     1, 0, 1,  // 前右
            -1, -1,  1,     1, 0, 1,  // 前左
        ]);

        this.vertexBuffer = this.device.createBuffer({
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX,
            mappedAtCreation: true,
        });
        new Float32Array(this.vertexBuffer.getMappedRange()).set(vertices);
        this.vertexBuffer.unmap();

        // 索引缓冲区 - 确保所有三角形都是逆时针
        const indices = new Uint16Array([
            // 每个面四个顶点，从0开始
            0,  1,  2,  2,  3,  0,  // 前面
            4,  5,  6,  6,  7,  4,  // 后面
            8,  9,  10, 10, 11, 8,  // 右面
            12, 13, 14, 14, 15, 12, // 左面
            16, 17, 18, 18, 19, 16, // 上面
            20, 21, 22, 22, 23, 20  // 下面
        ]);

        this.indexBuffer = this.device.createBuffer({
            size: indices.byteLength,
            usage: GPUBufferUsage.INDEX,
            mappedAtCreation: true,
        });
        new Uint16Array(this.indexBuffer.getMappedRange()).set(indices);
        this.indexBuffer.unmap();

        // 创建 MVP 矩阵的 Uniform 缓冲区
        this.uniformBuffer = this.device.createBuffer({
            size: 64, // 4x4 矩阵
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // 创建绑定组布局
        const bindGroupLayout = this.device.createBindGroupLayout({
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.VERTEX,
                buffer: { type: 'uniform' }
            }]
        });

        // 创建渲染管线布局
        const pipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout]
        });

        // 更新着色器代码
        const shader = this.device.createShaderModule({
            code: `
                struct Uniforms {
                    mvpMatrix : mat4x4<f32>,
                };
                @binding(0) @group(0) var<uniform> uniforms : Uniforms;

                struct VertexInput {
                    @location(0) position : vec3<f32>,
                    @location(1) color : vec3<f32>,
                };

                struct VertexOutput {
                    @builtin(position) position : vec4<f32>,
                    @location(0) color : vec3<f32>,
                };

                @vertex
                fn vs_main(input: VertexInput) -> VertexOutput {
                    var output : VertexOutput;
                    output.position = uniforms.mvpMatrix * vec4<f32>(input.position, 1.0);
                    output.color = input.color;
                    return output;
                }

                @fragment
                fn fs_main(@location(0) color : vec3<f32>) -> @location(0) vec4<f32> {
                    return vec4<f32>(color, 1.0);
                }
            `
        });

        // 更新渲染管线配置
        this.pipeline = this.device.createRenderPipeline({
            layout: pipelineLayout,
            vertex: {
                module: shader,
                entryPoint: 'vs_main',
                buffers: [{
                    arrayStride: 24, // 6个float：3个位置 + 3个颜色
                    attributes: [
                        {
                            // 位置
                            shaderLocation: 0,
                            offset: 0,
                            format: 'float32x3'
                        },
                        {
                            // 颜色
                            shaderLocation: 1,
                            offset: 12,
                            format: 'float32x3'
                        }
                    ]
                }]
            },
            fragment: {
                module: shader,
                entryPoint: 'fs_main',
                targets: [{
                    format: 'bgra8unorm'
                }]
            },
            primitive: {
                topology: 'triangle-list',
                cullMode: 'back'
            },
            depthStencil: {
                format: 'depth24plus',
                depthWriteEnabled: true,
                depthCompare: 'less'
            }
        });

        // 创建绑定组
        this.bindGroup = this.device.createBindGroup({
            layout: bindGroupLayout,
            entries: [{
                binding: 0,
                resource: { buffer: this.uniformBuffer }
            }]
        });
    }

    updateMVPMatrix() {
        // 更新模型旋转
        this.rotationAngle += 0.01;
        this.modelMatrix.makeRotationY(this.rotationAngle);
        
        // 确保相机矩阵是最新的
        this.camera.updateMatrixWorld();
        
        // 获取视图矩阵和投影矩阵
        const viewMatrix = this.camera.matrixWorldInverse;
        const projectionMatrix = this.camera.projectionMatrix;
        
        // 计算 MVP 矩阵
        const mvpMatrix = new Matrix4()
            .multiplyMatrices(projectionMatrix, viewMatrix)
            .multiply(this.modelMatrix);

        // 更新 Uniform 缓冲区
        this.device.queue.writeBuffer(
            this.uniformBuffer,
            0,
            new Float32Array(mvpMatrix.elements)
        );
    }

    async createDepthTexture(width, height) {
        if (this.depthTexture) {
            this.depthTexture.destroy();
        }

        if(this.resourceManager.GetResource(this.depthTextureName)){
            this.resourceManager.DeleteResource(this.depthTextureName);
        }


        this.depthTexture = this.resourceManager.CreateResource(this.depthTextureName,{
            Type: EResourceType.Texture,
            desc: {
                size: { width, height, depthOrArrayLayers: 1 },
                format: 'depth24plus',
                usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC,
            }
        })

        if(this.resourceManager.GetResource(this.colorAttachmentsName)){
            this.resourceManager.DeleteResource(this.colorAttachmentsName);
        }

        this.resourceManager.CreateResource(this.colorAttachmentsName,{
            Type: EResourceType.Texture,
            desc: {
                size: { width, height, depthOrArrayLayers: 1 },
                format: 'bgra8unorm',
                usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC,
            }
        })
    }

    /**
     * 获取深度纹理
     * @returns {GPUTexture} 深度纹理
     */
    GetDepthTexture() {
        return this.depthTexture;
    }

    /**
     * 获取深度纹理名称
     * @returns {string} 深度纹理名称
     */
    GetDepthTextureName() {
        return this.depthTextureName;
    }

    async OnResize(width, height) {
        if (!this.context) return;

        // 更新相机宽高比
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();

        // 更新深度纹理
        await this.createDepthTexture(width, height);

        // 重新配置 Canvas
        this.FCopyToCanvasPass.OnCanvasResize(width, height,this.context);

        this.context.configure({
            device: this.device,
            format: 'bgra8unorm',
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST
        });
    }

    // 添加相机控制方法
    SetCameraPosition(x, y, z) {
        this.camera.position.set(x, y, z);
        this.camera.updateMatrixWorld();
    }

    SetCameraTarget(x, y, z) {
        this.camera.lookAt(new Vector3(x, y, z));
        this.camera.updateMatrixWorld();
    }

    SetCameraFOV(fov) {
        this.camera.fov = fov;
        this.camera.updateProjectionMatrix();
    }

    Render() {
        if (!this.context || !this.depthTexture) return;
        this.updateMVPMatrix();

        const commandEncoder = this.device.createCommandEncoder();
        const textureView = this.context.getCurrentTexture().createView();

        const renderPassDescriptor = {
            colorAttachments: [{
                view: this.resourceManager.GetResource(this.colorAttachmentsName).createView(),
                clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store',
            }],
            depthStencilAttachment: {
                view: this.depthTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
            }
        };

        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setPipeline(this.pipeline);
        passEncoder.setBindGroup(0, this.bindGroup);
        passEncoder.setVertexBuffer(0, this.vertexBuffer);
        passEncoder.setIndexBuffer(this.indexBuffer, 'uint16');
        passEncoder.drawIndexed(36); // 6 faces * 2 triangles * 3 vertices
        passEncoder.end();

        this.FCopyToCanvasPass.SetSourceTexture(this.colorAttachmentsName);
        this.FCopyToCanvasPass.SetSourceTexture(this.depthTextureName);
        this.FCopyToCanvasPass.Execute(commandEncoder);

 

        this.device.queue.submit([commandEncoder.finish()]);
    }

    Destroy() {
        this.vertexBuffer?.destroy();
        this.indexBuffer?.destroy();
        this.uniformBuffer?.destroy();
        this.depthTexture?.destroy();
    }
}

export default TestRenderer;
