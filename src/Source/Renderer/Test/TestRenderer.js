import { PerspectiveCamera, Matrix4, Vector3 } from 'three';
import FResourceManager,{EResourceType} from '../../Core/Resource/FResourceManager';
import FCopyToCanvasPass from '../Pass/FCopyToCanvasPass';
import { FStaticMesh } from '../../Mesh/FStaticMesh';
import { ResourceConfig } from '../InitResource/DeferredRendering/ResourceConfig';
import ShaderIncluder from '../../Core/Shader/ShaderIncluder';
import FDeferredRenderingResourceManager from '../InitResource/DeferredRendering/FDeferredRenderingResourceManager';

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

        /** @type {FDeferredRenderingResourceManager} */
        this.deferredResourceManager = null;
    }

    async Initialize(device) {
        this.device = device;

        // 初始化延迟渲染资源管理器
        this.deferredResourceManager = FDeferredRenderingResourceManager.Initialize(device);

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
        
        // 设置相机到资源管理器
        this.deferredResourceManager.SetCamera(this.camera);

        await this.createPipelineAndResources();

        this.FStaticMesh = FStaticMesh.CreateSphere(1,10);
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
        // 创建渲染管线布局，使用 SceneBuffer 的布局
        const pipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [
                this.resourceManager.GetResource(ResourceConfig.GetSceneBuffers().layoutName)
            ]
        });

        // 更新着色器代码
        const shader = this.device.createShaderModule({
            code: await ShaderIncluder.GetShaderCode('Shader/DeferredShading/TestShader.wgsl')
        });

        // 更新渲染管线配置
        this.pipeline = this.device.createRenderPipeline({
            layout: pipelineLayout,
            vertex: {
                module: shader,
                entryPoint: 'vs_main',
                buffers: [ResourceConfig.GetStaticMeshLayout()]
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

        // 更新延迟渲染资源管理器的相机宽高比
        this.deferredResourceManager.UpdateCameraAspect(width, height);

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

    Render(deltaTime) {
        if (!this.context || !this.depthTexture || !this.FStaticMesh) return;

        // 1. 更新场景数据（相机、时间等）
        this.deferredResourceManager.UpdateSceneData(deltaTime);

        // 2. 开始渲染
        const commandEncoder = this.device.createCommandEncoder();

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

        // 3. 更新并设置每个模型的矩阵
        // 更新模型旋转
        this.rotationAngle += 0.01;
        this.modelMatrix.makeRotationY(this.rotationAngle);
        
        // 更新当前模型的矩阵
        this.deferredResourceManager.UpdateModuleMatrices(this.modelMatrix.elements);
        
        // 设置绑定组并绘制
        passEncoder.setBindGroup(0, this.deferredResourceManager.GetSceneBindgroup());
        passEncoder.setVertexBuffer(0, this.FStaticMesh.GetVertexBuffer());
        passEncoder.setIndexBuffer(this.FStaticMesh.GetIndexBuffer(), 'uint32');
        passEncoder.drawIndexed(this.FStaticMesh.GetIndexCount());
        
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
