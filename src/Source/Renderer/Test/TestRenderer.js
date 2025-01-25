import { PerspectiveCamera, Matrix4, Vector3 } from 'three';
import FResourceManager,{EResourceType} from '../../Core/Resource/FResourceManager';
import FCopyToCanvasPass from '../Pass/FCopyToCanvasPass';
import { FStaticMesh } from '../../Mesh/FStaticMesh';
import { ResourceConfig } from '../InitResource/DeferredRendering/ResourceConfig';
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

        this.FStaticMesh = null;
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

        this.FStaticMesh = FStaticMesh.CreateCube(2,1,3);
    }

    async InitCanvas(canvas) {
        this.canvas = canvas;
        this.context = canvas.getContext('webgpu');
        
        // 配置 Canvas
        this.context.configure({
            device: this.device,
            format: 'rgba8unorm',
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

        // 创建 MVP 矩阵的 Uniform 缓冲区
        this.uniformBuffer = this.device.createBuffer({
            size: 128, // 两个 4x4 矩阵 (64 * 2)
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
                    modelMatrix : mat4x4<f32>,  // 添加模型矩阵
                };
                @binding(0) @group(0) var<uniform> uniforms : Uniforms;

                struct VertexInput {
                    @location(0) position : vec3<f32>,
                    @location(1) normal : vec3<f32>,
                    @location(2) tangent : vec3<f32>,
                    @location(3) uv0 : vec2<f32>,
                    @location(4) uv1 : vec2<f32>,
                    @location(5) uv2 : vec2<f32>,
                    @location(6) uv3 : vec2<f32>,
                };

                struct VertexOutput {
                    @builtin(position) position : vec4<f32>,
                    @location(0) color : vec3<f32>,
                };

                // 辅助函数：计算法线矩阵（模型矩阵的逆转置矩阵的3x3部分）
                fn getNormalMatrix(modelMatrix: mat4x4<f32>) -> mat3x3<f32> {
                    let inverse = mat3x3<f32>(
                        modelMatrix[0].xyz,
                        modelMatrix[1].xyz,
                        modelMatrix[2].xyz
                    );
                    return transpose(inverse);
                }

                @vertex
                fn vs_main(input: VertexInput) -> VertexOutput {
                    var output : VertexOutput;
                    output.position = uniforms.mvpMatrix * vec4<f32>(input.position, 1.0);
                    
                    // 使用法线矩阵变换法线
                    let normalMatrix = getNormalMatrix(uniforms.modelMatrix);
                    let worldNormal = normalize(normalMatrix * input.normal);
                    
                    // 将世界空间法线转换为颜色
                    output.color = worldNormal * 0.5 + 0.5;
                    
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
                buffers:[ResourceConfig.GetStaticMeshLayout()]
            },
            fragment: {
                module: shader,
                entryPoint: 'fs_main',
                targets: [{
                    format: 'rgba8unorm'
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

        // 创建一个足够大的数组来存储两个矩阵
        const uniformData = new Float32Array(32); // 8 x 4 = 32 个浮点数

        // 复制 MVP 矩阵
        uniformData.set(mvpMatrix.elements, 0);
        // 复制模型矩阵
        uniformData.set(this.modelMatrix.elements, 16);

        // 更新 Uniform 缓冲区
        this.device.queue.writeBuffer(
            this.uniformBuffer,
            0,
            uniformData
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
                format: 'rgba8unorm',
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
            format: 'rgba8unorm',
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
        passEncoder.setVertexBuffer(0, this.FStaticMesh.GetVertexBuffer());
        passEncoder.setIndexBuffer(this.FStaticMesh.GetIndexBuffer(), 'uint32');
        passEncoder.drawIndexed(this.FStaticMesh.GetIndexCount()); // 6 faces * 2 triangles * 3 vertices
        passEncoder.end();

        this.FCopyToCanvasPass.SetSourceTexture(this.depthTextureName);
        this.FCopyToCanvasPass.SetSourceTexture(this.colorAttachmentsName);
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
