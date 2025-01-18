/* global GPUTextureUsage, GPUBufferUsage */
import FModuleManager from './Source/Core/FModuleManager';
import ViewportCanvas from './Source/UI/Components/MainContent/ViewportCanvas';
class Main {
    static ModuleManager = null;

    static async Initialize() {
        try {
            // 获取模块管理器实例
            Main.ModuleManager = FModuleManager.GetInstance();
            await Main.ModuleManager.Initialize();

            const UIModel = Main.ModuleManager.GetModule('UIModule');
            const DetailBuilder = UIModel.GetDetailBuilder();
            const mainContentBuilder = Main.ModuleManager.GetModule('UIModule').GetMainContentBuilder();
            //return;
            // 创建一个引用对象来存储所有属性
            const actorProperties = {
                basic: {
                    name: "TestCube",
                    guid: "F7977D324F1DA9A205CDF3A430F87F7E"
                },
                transform: {
                    position: [0, 0, 0],
                    rotation: [0, 0, 0],
                    scale: [1, 1, 1]
                },
                physics: {
                    mass: 100,
                    gravity: true,
                    simulated: true
                },
                rendering: {
                    visible: true,
                    castShadow: true,
                    material: "Default"
                }
            };

            // 更新函数现在直接修改引用对象
            const updateActorProperty = (path, value) => {
                const pathParts = path.split('.');
                const section = pathParts[0].toLowerCase();
                const property = pathParts[1].toLowerCase();
                
                // 直接修改引用对象中的值
                if (actorProperties[section]) {
                    actorProperties[section][property] = value;
                    console.log(`Property updated - ${path}:`, value);
                }
            };

            // 创建相机状态对象
            let cameraState = {
                position: [0, 0, 5],
                rotation: [0, 0, 0],
                fov: 60 * Math.PI / 180,
                near: 0.1,
                far: 100.0
            };

            // 添加相机属性到 DetailBuilder
            DetailBuilder.addProperties({
                'Camera.Position': {
                    value: [...cameraState.position],  // 创建新数组
                    label: '相机位置',
                    type: 'vector3',
                    onChange: (path, value) => {
                        cameraState.position = [...value];
                        console.log('Camera position updated:', value);
                    }
                },
                'Camera.Rotation': {
                    value: [...cameraState.rotation],
                    label: '相机旋转',
                    type: 'vector3',
                    onChange: (path, value) => {
                        cameraState.rotation = [...value];
                        console.log('Camera rotation updated:', value);
                    }
                },
                'Camera.FOV': {
                    value: 60,  // 使用角度值
                    label: '视野角度',
                    type: 'float',
                    onChange: (path, value) => {
                        cameraState.fov = value * Math.PI / 180;  // 转换为弧度
                        console.log('Camera FOV updated:', value);
                    }
                },
                'Camera.Near': {
                    value: cameraState.near,
                    label: '近裁面',
                    type: 'float',
                    onChange: (path, value) => {
                        cameraState.near = value;
                        console.log('Camera near plane updated:', value);
                    }
                },
                'Camera.Far': {
                    value: cameraState.far,
                    label: '远裁面',
                    type: 'float',
                    onChange: (path, value) => {
                        cameraState.far = value;
                        console.log('Camera far plane updated:', value);
                    }
                }
            });

            // 创建全局状态对象
            let globals = null;

            // 创建深度纹理的函数
            const createDepthTexture = () => {
                if (!globals || !globals.device) return;
            
                if (globals.depthTexture) {
                    globals.depthTexture.destroy();
                }
            
                globals.depthTexture = globals.device.createTexture({
                    size: { 
                        width: globals.canvas.width, 
                        height: globals.canvas.height, 
                        depthOrArrayLayers: 1 
                    },
                    format: 'depth24plus',
                    usage: GPUTextureUsage.RENDER_ATTACHMENT,
                });
            
                //console.log('Depth texture recreated with size:', globals.canvas.width, globals.canvas.height);
                globals.aspect = globals.canvas.width / globals.canvas.height;
            
                return globals.depthTexture;
            };
            

            // 定义 resize 处理函数
            let handleCanvasResize = (width, height) => {
                if (!globals || !globals.canvas) {
                    console.log('Canvas not initialized yet');
                    return;
                }
            
                const devicePixelRatio = window.devicePixelRatio || 1;
                globals.canvas.width = width * devicePixelRatio;
                globals.canvas.height = height * devicePixelRatio;
            
                // 重新配置上下文
                globals.context.configure({
                    device: globals.device,
                    format: navigator.gpu.getPreferredCanvasFormat(),
                    alphaMode: 'premultiplied',
                    usage: GPUTextureUsage.RENDER_ATTACHMENT,
                });
            
                // 重新创建深度纹理
                createDepthTexture();
            
                // 更新屏幕宽高比
                globals.aspect = globals.canvas.width / globals.canvas.height;
            
                //console.log('Canvas resized:', width, height);
            };
            

            const handleCanvasReady = (canvasInfo) => {
                console.log('Canvas ready:', canvasInfo);
                
                const initWebGPU = async () => {
                    try {
                        if (!navigator.gpu) throw new Error('WebGPU not supported');
                        const adapter = await navigator.gpu.requestAdapter();
                        if (!adapter) throw new Error('No adapter found');
                        const device = await adapter.requestDevice();
                        const context = canvasInfo.getContext('webgpu');
                        const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
                        
                        // 设置画布尺寸
                        const devicePixelRatio = window.devicePixelRatio || 1;
                        canvasInfo.width = canvasInfo.clientWidth * devicePixelRatio;
                        canvasInfo.height = canvasInfo.clientHeight * devicePixelRatio;

                        context.configure({
                            device,
                            format: canvasFormat,
                            alphaMode: 'premultiplied',
                        });

                        // 创建顶点缓冲区
                        const vertices = new Float32Array([
                            // 前面
                            -1, -1,  1,    1, -1,  1,    1,  1,  1,    -1,  1,  1,
                            // 后面
                            -1, -1, -1,   -1,  1, -1,    1,  1, -1,     1, -1, -1,
                            // 顶面
                            -1,  1, -1,   -1,  1,  1,    1,  1,  1,     1,  1, -1,
                            // 底面
                            -1, -1, -1,    1, -1, -1,    1, -1,  1,    -1, -1,  1,
                            // 右面
                             1, -1, -1,    1,  1, -1,    1,  1,  1,     1, -1,  1,
                            // 左面
                            -1, -1, -1,   -1, -1,  1,   -1,  1,  1,    -1,  1, -1,
                        ]);

                        const vertexBuffer = device.createBuffer({
                            size: vertices.byteLength,
                            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
                        });
                        device.queue.writeBuffer(vertexBuffer, 0, vertices);

                        // 创建索引缓冲区
                        const indices = new Uint16Array([
                            0,  1,  2,    2,  3,  0,  // 前面
                            4,  5,  6,    6,  7,  4,  // 后面
                            8,  9,  10,   10, 11, 8,  // 顶面
                            12, 13, 14,   14, 15, 12, // 底面
                            16, 17, 18,   18, 19, 16, // 右面
                            20, 21, 22,   22, 23, 20  // 左面
                        ]);

                        const indexBuffer = device.createBuffer({
                            size: indices.byteLength,
                            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,  // INDEX | COPY_DST | COPY_SRC
                        });
                        device.queue.writeBuffer(indexBuffer, 0, indices);

                        // 创建 uniform buffer 存储矩阵
                        const uniformBufferSize = 4 * 16 * 3; // 3个4x4矩阵
                        const uniformBuffer = device.createBuffer({
                            size: uniformBufferSize,
                            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
                        });

                        // 创建绑定组布局
                        const bindGroupLayout = device.createBindGroupLayout({
                            entries: [{
                                binding: 0,
                                visibility: GPUShaderStage.VERTEX,
                                buffer: { type: 'uniform' }
                            }]
                        });

                        // 创建绑定组
                        const uniformBindGroup = device.createBindGroup({
                            layout: bindGroupLayout,
                            entries: [{
                                binding: 0,
                                resource: { buffer: uniformBuffer }
                            }]
                        });

                        // 更新着色器代码，添加矩阵变换
                        const shader = device.createShaderModule({
                            code: `
                                struct Uniforms {
                                    modelMatrix : mat4x4f,
                                    viewMatrix : mat4x4f,
                                    projectionMatrix : mat4x4f,
                                }
                                @binding(0) @group(0) var<uniform> uniforms : Uniforms;

                                struct VertexOutput {
                                    @builtin(position) position : vec4f,
                                    @location(0) color : vec4f,
                                }

                                @vertex
                                fn vertexMain(@location(0) position: vec3f) -> VertexOutput {
                                    var output: VertexOutput;
                                    let worldPos = uniforms.modelMatrix * vec4f(position, 1.0);
                                    let viewPos = uniforms.viewMatrix * worldPos;
                                    output.position = uniforms.projectionMatrix * viewPos;
                                    output.color = vec4f(0.5 + position * 0.5, 1.0);
                                    return output;
                                }

                                @fragment
                                fn pixelMain(input: VertexOutput) -> @location(0) vec4f {
                                    return input.color;
                                }
                            `
                        });

                        // 更新渲染管线配置
                        const pipeline = await device.createRenderPipelineAsync({
                            layout: device.createPipelineLayout({
                                bindGroupLayouts: [bindGroupLayout]
                            }),
                            vertex: {
                                module: shader,
                                entryPoint: 'vertexMain',
                                buffers: [{
                                    arrayStride: 12,
                                    attributes: [{
                                        shaderLocation: 0,
                                        offset: 0,
                                        format: 'float32x3'
                                    }]
                                }]
                            },
                            fragment: {
                                module: shader,
                                entryPoint: 'pixelMain',
                                targets: [{
                                    format: canvasFormat
                                }]
                            },
                            primitive: {
                                topology: 'triangle-list',
                                cullMode: 'back'
                            },
                            depthStencil: {
                                depthWriteEnabled: true,
                                depthCompare: 'less',
                                format: 'depth24plus'
                            }
                        });

                        // 初始化全局状态
                        globals = {
                            device,
                            context,
                            canvas: canvasInfo,
                            depthTexture: null,
                            aspect: canvasInfo.width / canvasInfo.height
                        };

                        // 初始创建深度纹理
                        createDepthTexture();

                        function createViewMatrix() {
                            return new Float32Array([
                                1, 0, 0, 0,
                                0, 1, 0, 0,
                                0, 0, 1, 0,
                                -cameraState.position[0], -cameraState.position[1], -cameraState.position[2], 1
                            ]);
                        }

                        function createProjectionMatrix() {
                            const f = 1.0 / Math.tan(cameraState.fov / 2);
                            return new Float32Array([
                                f / globals.aspect, 0, 0, 0,
                                0, f, 0, 0,
                                0, 0, (cameraState.far + cameraState.near) / (cameraState.near - cameraState.far), -1,
                                0, 0, (2 * cameraState.far * cameraState.near) / (cameraState.near - cameraState.far), 0
                            ]);
                        }

                        function createModelMatrix(time) {
                            const rotation = time * 0.001;
                            return new Float32Array([
                                Math.cos(rotation), 0, -Math.sin(rotation), 0,
                                0, 1, 0, 0,
                                Math.sin(rotation), 0, Math.cos(rotation), 0,
                                0, 0, 0, 1
                            ]);
                        }

                        // 渲染循环
                        function render() {
                            if (!globals || !globals.depthTexture) {
                                console.log('Waiting for depth texture...');
                                requestAnimationFrame(render);
                                return;
                            }
                        
                            const time = performance.now();
                        
                            // 更新矩阵
                            const modelMatrix = createModelMatrix(time);
                            const viewMatrix = createViewMatrix();
                            const projectionMatrix = createProjectionMatrix();
                        
                            // 更新 uniform buffer
                            device.queue.writeBuffer(uniformBuffer, 0, modelMatrix);
                            device.queue.writeBuffer(uniformBuffer, 64, viewMatrix);
                            device.queue.writeBuffer(uniformBuffer, 128, projectionMatrix);
                        
                            const commandEncoder = device.createCommandEncoder();
                            const renderPass = commandEncoder.beginRenderPass({
                                colorAttachments: [{
                                    view: globals.context.getCurrentTexture().createView(),
                                    clearValue: { r: 0.8, g: 0.1, b: 0.1, a: 1.0 },
                                    loadOp: 'clear',
                                    storeOp: 'store',
                                }],
                                depthStencilAttachment: {
                                    view: globals.depthTexture.createView(),
                                    depthClearValue: 1.0,
                                    depthLoadOp: 'clear',
                                    depthStoreOp: 'store',
                                }
                            });
                        
                            renderPass.setPipeline(pipeline);
                            renderPass.setBindGroup(0, uniformBindGroup);
                            renderPass.setVertexBuffer(0, vertexBuffer);
                            renderPass.setIndexBuffer(indexBuffer, 'uint16');
                            renderPass.drawIndexed(36);
                            renderPass.end();
                        
                            device.queue.submit([commandEncoder.finish()]);
                            requestAnimationFrame(render);
                        }
                        

                        render();
                        console.log('WebGPU cube rendering initialized with camera');

                    } catch (error) {
                        console.error('WebGPU initialization failed:', error);
                    }
                };

                initWebGPU();
            };

            // 添加 ViewportCanvas
            mainContentBuilder.addComponent(
                'viewport',
                'ViewportCanvas',
                <ViewportCanvas 
                    onCanvasReady={handleCanvasReady}
                    onResize={handleCanvasResize}
                    id="ViewportCanvas"
                />
            );

            // 检查组件是否存在
            if (mainContentBuilder.hasComponent('viewport', 'ViewportCanvas')) {
                console.log('Canvas component exists');
            }

            // 获取所有视口组件
            const viewportComponents = mainContentBuilder.getComponents('viewport');
            console.log('Viewport components:', viewportComponents);

            // 获取组件数量
            const toolbarCount = mainContentBuilder.getComponentCount('toolbar');
            console.log('Toolbar components count:', toolbarCount);

            // 每隔5秒打印属性
            setInterval(() => {
                console.log('Actor Properties:', actorProperties);
            }, 5000);

            console.log('System initialized with test properties');
        } catch (Error) {
            console.error('Initialization failed:', Error);
        }
    }
}

export default Main; 