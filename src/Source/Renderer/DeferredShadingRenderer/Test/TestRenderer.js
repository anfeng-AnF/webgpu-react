import * as THREE from 'three';
import FResourceManager from '../../../Core/Resource/FResourceManager.js';

class TestRenderer {
    constructor() {
        /**
         * 资源管理器
         * @type {FResourceManager}
         * @private
         */
        this._ResourceManager = FResourceManager.GetInstance();

        /**
         * 场景
         * @type {THREE.Scene}
         * @private
         */
        this._Scene = null;

        /**
         * 相机
         * @type {THREE.PerspectiveCamera}
         * @private
         */
        this._Camera = null;

        /**
         * 深度目标
         * @type {GPUTexture}
         * @private
         */
        this._DepthTexture = null;

        /**
         * 顶点缓冲区
         * @type {GPUBuffer}
         * @private
         */
        this._VertexBuffer = null;

        /**
         * 渲染管线
         * @type {GPURenderPipeline}
         * @private
         */
        this._Pipeline = null;

        /**
         * Canvas
         * @type {HTMLCanvasElement}
         * @private
         */
        this._Canvas = null;

        /**
         * WebGPU Context
         * @type {GPUCanvasContext}
         * @private
         */
        this._Context = null;

        /**
         * 设备
         * @type {GPUDevice}
         * @private
         */
        this._Device = null;

        /**
         * 相机的Uniform缓冲区
         * @type {GPUBuffer}
         * @private
         */
        this._CameraUniformBuffer = null;

        /**
         * 相机的BindGroup
         * @type {GPUBindGroup}
         * @private
         */
        this._CameraBindGroup = null;

        /**
         * 模型矩阵
         * @type {THREE.Matrix4}
         * @private
         */
        this._ModelMatrix = new THREE.Matrix4();

        /**
         * 旋转角度
         * @type {number}
         * @private
         */
        this._Rotation = 0;

        /**
         * 模型的Uniform缓冲区
         * @type {GPUBuffer}
         * @private
         */
        this._ModelUniformBuffer = null;

        /**
         * 模型的BindGroup
         * @type {GPUBindGroup}
         * @private
         */
        this._ModelBindGroup = null;

        /**
         * 渲染目标纹理
         * @type {GPUTexture}
         * @private
         */
        this._RenderTargetTexture = null;
    }

    async Initialize(canvas) {
        this._Canvas = canvas;
        this._Context = canvas.getContext('webgpu');
        this._Device = await this._ResourceManager.GetDevice();

        // 创建渲染目标纹理
        this._RenderTargetTexture = this._ResourceManager.CreateResource(
            'TestRenderTarget',
            {
                Type: 'Texture',
                desc: {
                    size: [canvas.width, canvas.height, 1],
                    format: navigator.gpu.getPreferredCanvasFormat(),
                    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING 
                    | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC,
                }
            }
        );

        // 创建场景和相机
        this._Scene = new THREE.Scene();
        this._Camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
        this._Camera.position.set(2, 2, 2);  // 调整相机位置
        this._Camera.lookAt(0, 0, 0);        // 看向原点

        // 创建深度纹理
        this._DepthTexture = this._ResourceManager.CreateResource(
            'TestDepthTexture',
            {
                Type: 'Texture',
                desc: {
                    size: [canvas.width, canvas.height, 1],
                    format: 'depth24plus',
                    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
                }
            }
        );

        // 创建box顶点数据
        const vertices = new Float32Array([
            // 前面 (红色)
            -0.5, -0.5,  0.5,  1.0, 0.0, 0.0,
             0.5, -0.5,  0.5,  1.0, 0.0, 0.0,
             0.5,  0.5,  0.5,  1.0, 0.0, 0.0,
            -0.5,  0.5,  0.5,  1.0, 0.0, 0.0,
            // 后面 (绿色)
            -0.5, -0.5, -0.5,  0.0, 1.0, 0.0,
             0.5, -0.5, -0.5,  0.0, 1.0, 0.0,
             0.5,  0.5, -0.5,  0.0, 1.0, 0.0,
            -0.5,  0.5, -0.5,  0.0, 1.0, 0.0,
        ]);

        const indices = new Uint16Array([
            0, 1, 2,  2, 3, 0,  // 前面
            1, 5, 6,  6, 2, 1,  // 右面
            5, 4, 7,  7, 6, 5,  // 后面
            4, 0, 3,  3, 7, 4,  // 左面
            3, 2, 6,  6, 7, 3,  // 上面
            4, 5, 1,  1, 0, 4   // 下面
        ]);

        // 创建顶点缓冲区
        this._VertexBuffer = this._ResourceManager.CreateResource(
            'TestVertexBuffer',
            {
                Type: 'Buffer',
                desc: {
                    size: vertices.byteLength,
                    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
                }
            }
        );
        this._Device.queue.writeBuffer(this._VertexBuffer, 0, vertices);

        // 创建索引缓冲区
        this._IndexBuffer = this._ResourceManager.CreateResource(
            'TestIndexBuffer',
            {
                Type: 'Buffer',
                desc: {
                    size: indices.byteLength,
                    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
                }
            }
        );
        this._Device.queue.writeBuffer(this._IndexBuffer, 0, indices);

        // 创建相机Uniform缓冲区
        this._CameraUniformBuffer = this._ResourceManager.CreateResource(
            'TestCameraUniform',
            {
                Type: 'Buffer',
                desc: {
                    size: 64, // 4x4矩阵 = 16 * float32
                    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
                }
            }
        );

        // 创建模型Uniform缓冲区
        this._ModelUniformBuffer = this._ResourceManager.CreateResource(
            'TestModelUniform',
            {
                Type: 'Buffer',
                desc: {
                    size: 64, // 4x4矩阵 = 16 * float32
                    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
                }
            }
        );

        // 创建渲染管线
        this._Pipeline = this._ResourceManager.CreateResource(
            'TestPipeline',
            {
                Type: 'RenderPipeline',
                desc: {
                    layout: 'auto',
                    vertex: {
                        module: this._Device.createShaderModule({
                            code: `
                                struct CameraUniform {
                                    viewProj: mat4x4<f32>,
                                }
                                @binding(0) @group(0) var<uniform> camera: CameraUniform;

                                struct ModelUniform {
                                    model: mat4x4<f32>,
                                }
                                @binding(0) @group(1) var<uniform> transform: ModelUniform;

                                struct VertexOutput {
                                    @builtin(position) position: vec4<f32>,
                                    @location(0) color: vec3<f32>,
                                }

                                @vertex
                                fn main(
                                    @location(0) position: vec3<f32>,
                                    @location(1) color: vec3<f32>
                                ) -> VertexOutput {
                                    var output: VertexOutput;
                                    output.position = camera.viewProj * transform.model * vec4<f32>(position, 1.0);
                                    output.color = color;
                                    return output;
                                }
                            `
                        }),
                        entryPoint: 'main',
                        buffers: [{
                            arrayStride: 24,
                            attributes: [
                                {
                                    shaderLocation: 0,
                                    offset: 0,
                                    format: 'float32x3'
                                },
                                {
                                    shaderLocation: 1,
                                    offset: 12,
                                    format: 'float32x3'
                                }
                            ]
                        }]
                    },
                    fragment: {
                        module: this._Device.createShaderModule({
                            code: `
                                @fragment
                                fn main(@location(0) color: vec3<f32>) -> @location(0) vec4<f32> {
                                    return vec4<f32>(color, 1.0);
                                }
                            `
                        }),
                        entryPoint: 'main',
                        targets: [{
                            format: navigator.gpu.getPreferredCanvasFormat()
                        }]
                    },
                    primitive: {
                        topology: 'triangle-list',
                        cullMode: 'back'
                    },
                    depthStencil: {
                        depthWriteEnabled: true,
                        depthCompare: 'less',
                        format: 'depth24plus',
                        depthBias: 0,
                        depthBiasSlopeScale: 0,
                        depthBiasClamp: 0
                    }
                }
            }
        );

        // 创建相机BindGroup
        this._CameraBindGroup = this._ResourceManager.CreateResource(
            'TestCameraBindGroup',
            {
                Type: 'BindGroup',
                desc: {
                    layout: this._Pipeline.getBindGroupLayout(0),
                    entries: [{
                        binding: 0,
                        resource: {
                            buffer: this._CameraUniformBuffer,
                        },
                    }],
                }
            }
        );

        // 创建模型BindGroup
        this._ModelBindGroup = this._ResourceManager.CreateResource(
            'TestModelBindGroup',
            {
                Type: 'BindGroup',
                desc: {
                    layout: this._Pipeline.getBindGroupLayout(1),
                    entries: [{
                        binding: 0,
                        resource: {
                            buffer: this._ModelUniformBuffer,
                        },
                    }],
                }
            }
        );

        // 初始化模型矩阵
        this._UpdateModelMatrix();

        // 更新相机矩阵
        this._UpdateCameraMatrix();
    }

    _UpdateCameraMatrix() {
        // 确保相机已初始化
        if (!this._Camera) {
            return;
        }

        // 确保相机的矩阵已更新
        this._Camera.updateMatrixWorld();
        this._Camera.updateMatrix();
        this._Camera.updateProjectionMatrix();

        // 创建视图投影矩阵
        const viewProjectionMatrix = new Float32Array(16);
        const tmpMatrix = new THREE.Matrix4();
        tmpMatrix.multiplyMatrices(this._Camera.projectionMatrix, this._Camera.matrixWorldInverse);
        viewProjectionMatrix.set(tmpMatrix.elements);

        // 确保Uniform缓冲区已创建
        if (this._CameraUniformBuffer && this._Device) {
            // 更新Uniform缓冲区
            this._Device.queue.writeBuffer(
                this._CameraUniformBuffer,
                0,
                viewProjectionMatrix.buffer,
                viewProjectionMatrix.byteOffset,
                viewProjectionMatrix.byteLength
            );
        }
    }

    _UpdateModelMatrix() {
        // 重置矩阵
        this._ModelMatrix.identity();
        
        // 添加旋转（直接使用旋转角度）
        this._ModelMatrix.makeRotationY(this._Rotation);
        
        // 添加一些平移，让旋转更明显
        this._ModelMatrix.setPosition(0, 0, 0);
        
        // 转换为Float32Array
        const modelMatrix = new Float32Array(16);
        modelMatrix.set(this._ModelMatrix.elements);

        // 更新Uniform缓冲区
        if (this._ModelUniformBuffer && this._Device) {
            this._Device.queue.writeBuffer(
                this._ModelUniformBuffer,
                0,
                modelMatrix.buffer,
                modelMatrix.byteOffset,
                modelMatrix.byteLength
            );
        }
    }

    /**
     * 获取渲染目标纹理
     * @returns {GPUTexture} 渲染目标纹理
     */
    GetRenderTarget() {
        return this._RenderTargetTexture;
    }

    /**
     * 渲染场景
     * @param {number} DeltaTime 时间差
     * @param {GPUCommandEncoder} CommandEncoder 命令编码器
     */
    Render(DeltaTime, CommandEncoder) {
        // 更新旋转角度 (使用更大的系数)
        this._Rotation += DeltaTime * 0.001; // 增加旋转速度
        this._Rotation %= Math.PI * 2; // 保持在 0-2π 范围内
        this._UpdateModelMatrix();
        
        // 更新相机矩阵
        this._UpdateCameraMatrix();

        // 修改渲染通道，使用渲染目标纹理
        const renderPass = CommandEncoder.beginRenderPass({
            colorAttachments: [{
                view: this._RenderTargetTexture.createView(),
                clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store'
            }],
            depthStencilAttachment: {
                view: this._DepthTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store'
            }
        });

        // 设置渲染管线和顶点缓冲区
        renderPass.setPipeline(this._Pipeline);
        renderPass.setVertexBuffer(0, this._VertexBuffer);
        renderPass.setIndexBuffer(this._IndexBuffer, 'uint16');

        // 设置相机和模型的BindGroup
        renderPass.setBindGroup(0, this._CameraBindGroup);
        renderPass.setBindGroup(1, this._ModelBindGroup);

        // 绘制
        renderPass.drawIndexed(36); // 6面 * 2三角形 * 3顶点
        renderPass.end();
    }

    Resize(width, height) {
        // 确保相机已初始化
        if (!this._Camera) {
            return;
        }

        this._Camera.aspect = width / height;
        this._Camera.updateProjectionMatrix();

        // 重新创建深度纹理
        if (this._DepthTexture) {
            // 先删除旧的深度纹理
            this._ResourceManager.DeleteResource('TestDepthTexture');
            
            // 创建新的深度纹理
            this._DepthTexture = this._ResourceManager.CreateResource(
                'TestDepthTexture',
                {
                    Type: 'Texture',
                    desc: {
                        size: [width, height, 1],
                        format: 'depth24plus',
                        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
                    }
                }
            );
        }

        // 重新创建渲染目标纹理
        if (this._RenderTargetTexture) {
            this._ResourceManager.DeleteResource('TestRenderTarget');
            
            this._RenderTargetTexture = this._ResourceManager.CreateResource(
                'TestRenderTarget',
                {
                    Type: 'Texture',
                    desc: {
                        size: [width, height, 1],
                        format: navigator.gpu.getPreferredCanvasFormat(),
                        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING 
                        | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC,
                    }
                }
            );
        }

        // 移除 context 配置，因为不再直接渲染到 Canvas
    }

    Destroy() {
        // 清理资源
        this._ResourceManager.DeleteResource('TestDepthTexture');
        this._ResourceManager.DeleteResource('TestVertexBuffer');
        this._ResourceManager.DeleteResource('TestIndexBuffer');
        this._ResourceManager.DeleteResource('TestPipeline');
        this._ResourceManager.DeleteResource('TestCameraUniform');
        this._ResourceManager.DeleteResource('TestCameraBindGroup');
        this._ResourceManager.DeleteResource('TestModelUniform');
        this._ResourceManager.DeleteResource('TestModelBindGroup');
        this._ResourceManager.DeleteResource('TestRenderTarget');
    }
}

export default TestRenderer;
