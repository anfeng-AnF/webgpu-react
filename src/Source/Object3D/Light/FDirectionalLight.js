import * as THREE from 'three';
import FResourceManager from '../../Core/Resource/FResourceManager';
import { resourceName } from '../../Renderer/DeferredShadingRenderer/ResourceNames';
import IGPULight from './IGPULight';
import GPUScene from '../../Scene/GPUScene';
import FModuleManager from '../../Core/FModuleManager';
import ShaderIncluder from '../../Core/Shader/ShaderIncluder';
import StaticMesh from '../Mesh/StaticMesh';

/**
 * Represents a directional light with GPU resource management.
 * Implements the IGPULight interface to handle GPU buffer creation,
 * updating, and destruction.
 *
 * Buffer Layout (total 192 bytes):
 *   lightDirection:    vec4<f32>     16 bytes, offset 0  - 15 bytes
 *   lightColor:        vec4<f32>     16 bytes, offset 16 - 31 bytes
 *   lightIntensity:    f32           4 bytes,  offset 32 - 35 bytes
 *   bShowCascade:      f32           4 bytes,  offset 36 - 39 bytes
 *   numCascades:       u32           4 bytes,  offset 40 - 43 bytes
 *   padding:           f32array[5]   24 bytes, offset 44 - 63 bytes
 *
 * cascade buffer layout (storage buffer)
 *  preArrayElementLayout:{align 256
 *      viewMatrix:             mat4x4<f32>   64 bytes, offset 0   - 63  bytes
 *      projectionMatrix:       mat4x4<f32>   64 bytes, offset 64  - 127 bytes
 *      sphereCenter+Radius:    vec4<f32>     16 bytes, offset 128 - 143 bytes xyz for world position, w for radius
 *      cascadeDepth:           vec4<f32>     16 bytes, offset 144 - 159 bytes
 *      lightBiasNormalBias:    vec4<f32>     16 bytes, offset 160 - 175 bytes
 *      padding:                f32array[20]  80 bytes, offset 175 - 255 bytes
 *  }
 *
 * @class FDirectionalLight
 * @extends THREE.DirectionalLight
 * @implements IGPULight
 */
class FDirectionalLight extends THREE.DirectionalLight {
    /**
     * 可调参数集
     * @type {Object} params
     * @property {THREE.Vector3} lightDirection - 默认光照方向
     * @property {THREE.Color} color - 颜色
     * @property {number} intensity - 强度
     * @property {number} numCascades - 级联数量
     * @property {Float32Array} cascadeLightBias - 级联深度偏移
     * @property {Float32Array} cascadeNormalBias - 级联法线偏移
     * @property {number} splitThreshold - 级联分割的线性/对数混合阈值
     * @property {number} size - 每张阴影贴图边长
     * @property {number} cascadeNear - 级联相机近平面
     * @description Additional parameters for the light.
     */
    params = {
        lightDirection: new THREE.Vector3(-0.5, -1, -0.5), // 默认光照方向
        color: new THREE.Color(1.0, 1.0, 1.0), // 颜色
        intensity: 1.0, // 强度

        // 级联阴影
        numCascades: 8, // 级联数量
        cascadeLightBias: [], // 级联深度偏移
        cascadeNormalBias: [], // 级联法线偏移
        splitThreshold: 0.0005, // 级联分割的线性/对数混合阈值
        size: 1024, // 每张阴影贴图边长
        cascadeNear: 0.1, // 级联相机近平面
        farMultiplier: 3.0, // 级联相机远平面 = radius * farMultiplier
        farOffset: 20.0, // 级联相机远平面额外偏移

        // 控制参数
        bShowCascade: false,
    };
    /**
     * 平行光缓冲区
     * @type {GPUBuffer}
     */
    BasicInfoBuffer = null;

    /**
     * 平行光阴影贴图
     * @type {GPUTexture}
     */
    shadowMaps = null;

    static cascadeInfoSizePerElement = 256;
    static baseInfoSize = 64;

    /**
     * 级联信息
     * @type {array<number>[numCascades]}
     */
    #cascades = [];

    /**
     * 级联相机
     * @type {THREE.OrthographicCamera[]}
     */
    #cascadeCameras = [];

    /**
     * 级联包围球
     * @type {array<{center:THREE.Vector3, radius:number}>[numCascades]}
     */
    #cascadeSpheres = [];

    /**
     * Creates an instance of DirectLight.
     * @param {THREE.Camera} mainCamera - The main camera. required for cascade shadow mapping.
     * @param {THREE.Color | number | string} color - The light color.
     * @param {number} intensity - The light intensity.
     * @param {number} numCascades - The number of cascades.
     * @param {number} splitThreshold - The threshold for splitting the cascades split that lerp linear and Logarithmic.default use logarithmic.
     * @param {number} size - The size of the shadow map.
     */
    constructor(
        mainCamera,
        color = new THREE.Color(1.0, 1.0, 1.0),
        intensity = 3.0,
        lightDirection = new THREE.Vector3(0, 0, 0),
        numCascades = 8,
        splitThreshold = 0.0005,
        size = 1024
    ) {
        super(color, intensity);
        this.params.LightDirection = lightDirection;

        // Bias may be used in shadow mapping calculations.
        this.bias = 0.0;
        this.mainCamera = mainCamera;
        this.params.numCascades = numCascades;
        this.params.splitThreshold = splitThreshold;
        this.params.size = size;
        this.params.intensity = intensity;
        /**
         * 初始化cascade相机
         * @type {THREE.OrthographicCamera[]}
         */
        this.cascadeCameras = [];
        // 创建numCascades个相机
        for (let i = 0; i < numCascades; i++) {
            this.cascadeCameras.push(
                new THREE.OrthographicCamera(
                    -10,
                    10, // 左右
                    10,
                    -10, // 上下
                    0, // near
                    600 // far
                )
            );
        }

        // 初始化级联偏移
        /**
         * 级联偏移
         * @type {Float32Array}
         */
        this.params.cascadeLightBias = new Float32Array(this.params.numCascades);

        /**
         * 级联法线偏移
         * @type {Float32Array}
         */
        this.params.cascadeNormalBias = new Float32Array(this.params.numCascades);

        // 初始化默认值
        let BasicBias = 0.00001;
        let BasicNormalBias = 0.002;
        for (let i = 0; i < this.params.numCascades; i++) {
            this.params.cascadeLightBias[i] = BasicBias * Math.pow(2, i);
            this.params.cascadeNormalBias[i] = BasicNormalBias * Math.pow(2, i);
        }
    }

    /**
     * The identifier for the DirectLight GPU buffer.
     * @type {string}
     */
    static BufferName = 'DirectLightBuffer';

    /**
     * Initializes GPU resources for DirectLight, including the GPU buffer and shadow map texture.
     *
     * @async
     * @returns {Promise<void>}
     */ f;
    async Init() {
        const DirectLightBufferDesc = {
            Type: 'Buffer',
            desc: {
                size: FDirectionalLight.baseInfoSize,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
            },
        };

        this.cascadeInfoBuffer = await FResourceManager.GetInstance().CreateResource(
            'CascadeInfoBuffer',
            {
                Type: 'Buffer',
                desc: {
                    size: FDirectionalLight.cascadeInfoSizePerElement * this.params.numCascades,
                    usage:
                        GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
                },
            }
        );

        this.BasicInfoBuffer = await FResourceManager.GetInstance().CreateResource(
            FDirectionalLight.BufferName,
            DirectLightBufferDesc
        );

        // Create shadow map texture resource.
        const shadowMapDesc = {
            Type: 'Texture',
            desc: {
                size: [this.params.size, this.params.size, this.params.numCascades],
                format: 'depth32float',
                usage:
                    GPUTextureUsage.RENDER_ATTACHMENT |
                    GPUTextureUsage.COPY_DST |
                    GPUTextureUsage.TEXTURE_BINDING |
                    GPUTextureUsage.COPY_SRC,
                sampleCount: 1,
                mipLevelCount: 1,
            },
        };

        this.shadowMaps = FResourceManager.GetInstance().CreateResource(
            resourceName.Light.DirectLightShadowMap,
            shadowMapDesc
        );

        this.lightBindGroupLayout = await FResourceManager.GetInstance().CreateResource(
            'DirectLightBindGroupLayout',
            {
                Type: 'BindGroupLayout',
                desc: {
                    entries: [
                        {
                            binding: 0,
                            visibility:
                                GPUShaderStage.VERTEX |
                                GPUShaderStage.FRAGMENT |
                                GPUShaderStage.COMPUTE,
                            buffer: { type: 'uniform' },
                        },
                        {
                            binding: 1,
                            visibility:
                                GPUShaderStage.VERTEX |
                                GPUShaderStage.FRAGMENT |
                                GPUShaderStage.COMPUTE,
                            buffer: { type: 'read-only-storage', hasDynamicOffset: true },
                        },
                    ],
                },
            }
        );

        this.lightBindGroupLayoutWithoutOffset =
            await FResourceManager.GetInstance().CreateResource(
                'DirectLightBindGroupLayoutWithoutOffset',
                {
                    Type: 'BindGroupLayout',
                    desc: {
                        entries: [
                            {
                                binding: 0,
                                visibility:
                                    GPUShaderStage.VERTEX |
                                    GPUShaderStage.FRAGMENT |
                                    GPUShaderStage.COMPUTE,
                                buffer: { type: 'uniform' },
                            },
                            {
                                binding: 1,
                                visibility:
                                    GPUShaderStage.VERTEX |
                                    GPUShaderStage.FRAGMENT |
                                    GPUShaderStage.COMPUTE,
                                buffer: { type: 'read-only-storage', hasDynamicOffset: false },
                            },
                        ],
                    },
                }
            );

        this.lightBindGroup = await FResourceManager.GetInstance().CreateResource(
            'DirectLightBindGroup',
            {
                Type: 'BindGroup',
                desc: {
                    layout: this.lightBindGroupLayout,
                    entries: [
                        {
                            binding: 0,
                            resource: { buffer: this.BasicInfoBuffer },
                        },
                        {
                            binding: 1,
                            resource: {
                                buffer: this.cascadeInfoBuffer,
                                size: FDirectionalLight.cascadeInfoSizePerElement,
                            },
                        },
                    ],
                },
            }
        );

        this.lightBindGroupWithoutOffset = await FResourceManager.GetInstance().CreateResource(
            'DirectLightBindGroupWithoutOffset',
            {
                Type: 'BindGroup',
                desc: {
                    layout: this.lightBindGroupLayoutWithoutOffset,
                    entries: [
                        {
                            binding: 0,
                            resource: { buffer: this.BasicInfoBuffer },
                        },
                        {
                            binding: 1,
                            resource: {
                                buffer: this.cascadeInfoBuffer,
                            },
                        },
                    ],
                },
            }
        );

        // pipelineLayout
        const pipelineLayout = await FResourceManager.GetInstance().CreateResource(
            'DirectLightPipelineLayout',
            {
                Type: 'PipelineLayout',
                desc: {
                    bindGroupLayouts: [
                        FResourceManager.GetInstance().GetResource(
                            resourceName.Scene.sceneBindGroupLayout
                        ),
                        this.lightBindGroupLayout,
                    ],
                },
            }
        );

        const shaderModule = await FResourceManager.GetInstance().CreateResource(
            'Shader/LightPass/CascadeShadowMap.wgsh',
            {
                Type: 'ShaderModule',
                desc: {
                    code: await ShaderIncluder.GetShaderCode(
                        '/Shader/LightPass/CascadeShadowMap.wgsl'
                    ),
                },
            }
        );

        this.pipeline = await FResourceManager.GetInstance().CreateResource('DirectLightPipeline', {
            Type: 'RenderPipeline',
            desc: {
                layout: pipelineLayout,
                vertex: {
                    module: shaderModule,
                    entryPoint: 'VSMain',
                    buffers: [StaticMesh.VertexBufferDesc],
                },
                // 阴影通道不需要颜色输出，只输出深度
                primitive: {
                    topology: 'triangle-list',
                    cullMode: 'back',
                },
                depthStencil: {
                    depthWriteEnabled: true,
                    depthCompare: 'less',
                    format: 'depth32float',
                    storeOp: 'store',
                    loadOp: 'clear',
                },
            },
        });
    }

    /**
     * 渲染阴影贴图
     * @param {number} deltaTime - 时间
     * @param {GPUScene} Scene - 场景
     * @param {GPUCommandEncoder} commandEncoder - 命令编码器
     * @param {Renderer} renderer - 渲染器
     */
    renderShadowMap(deltaTime, Scene, commandEncoder, renderer) {
        for (let i = 0; i < this.params.numCascades; i++) {
            const renderPassDesc = {
                colorAttachments: [],
                depthStencilAttachment: {
                    view: this.shadowMaps.createView({
                        dimension: '2d-array',
                        arrayLayerCount: 1,
                        baseArrayLayer: i,
                    }),
                    depthLoadOp: 'clear',
                    depthClearValue: 1.0,
                    depthStoreOp: 'store',
                },
            };
            const passEncoder = commandEncoder.beginRenderPass(renderPassDesc);
            passEncoder.setPipeline(this.pipeline);

            const meshes = Scene.GetAllMesh();
            for (const mesh of meshes) {
                const dynamicOffset = Scene.getMeshOffset(mesh.uuid);
                passEncoder.setBindGroup(0, Scene.sceneBindGroup, [dynamicOffset]);
                passEncoder.setBindGroup(1, this.lightBindGroup, [
                    i * FDirectionalLight.cascadeInfoSizePerElement,
                ]);

                //Scene.debugCheckMeshInfo(mesh.uuid);
                passEncoder.setVertexBuffer(0, mesh.GPUVertexBuffer);
                passEncoder.setIndexBuffer(mesh.GPUIndexBuffer, 'uint16');

                passEncoder.drawIndexed(mesh.geometry.index.count, 1, 0, 0, 0);
            }

            passEncoder.end();
        }
    }

    /**
     * Updates DirectLight's GPU buffer with the current light properties.
     *
     * @async
     * @param {GPUScene} scene - 场景
     * @returns {Promise<void>}
     */
    async update(scene) {
        this.scene = scene;
        // 更新世界矩阵
        this.updateMatrixWorld(true);

        const resourceManager = FResourceManager.GetInstance();
        // 检查GPU资源是否存在，如果不存在则初始化
        if (
            !(
                resourceManager.GetResource(FDirectionalLight.BufferName) &&
                resourceManager.GetResource(resourceName.Light.DirectLightShadowMap)
            )
        ) {
            await this.Init();
        }

        this.#caculateCascadeCamera(this.mainCamera);

        await this.#writeBasicInfoBuffer(scene);
        await this.#writeCascadeInfoBuffer(scene);

        //await this.debugCheckBasicInfo();
        //await this.debugCheckAllCascades();
    }

    async #writeBasicInfoBuffer(scene) {
        const resourceManager = FResourceManager.GetInstance();

        // 打包数据到 Float32Array (16 floats = 64 bytes)
        const data = new Float32Array(
            FDirectionalLight.baseInfoSize / Float32Array.BYTES_PER_ELEMENT
        );
        let offset = 0;

        data.set(
            [this.params.lightDirection.x, this.params.lightDirection.y, this.params.lightDirection.z, 0.0],
            offset
        );
        offset += 4;

        // 写入 lightColor (vec4, 16 bytes)
        data.set([this.params.color.r, this.params.color.g, this.params.color.b, 1.0], offset);
        offset += 4;

        // 写入 lightIntensity (f32, 4 bytes)
        data[offset++] = this.params.intensity;

        // 写入 bShowCascade (f32, 4 bytes)
        data[offset++] = this.params.bShowCascade?1.0:0.0;

        // 写入 numCascades (u32, 4 bytes)
        data[offset++] = this.params.numCascades;

        // 写入 padding0 (f32, 4 bytes)
        data[offset++] = 0.0;

        // 写入 padding1 (vec4, 16 bytes)
        data.set([0.0, 0.0, 0.0, 0.0], offset);
        offset += 4;

        // 上传缓冲区到 GPU
        const device = await resourceManager.GetDevice();
        const buffer = this.BasicInfoBuffer;
        device.queue.writeBuffer(buffer, 0, data);
    }

    async #writeCascadeInfoBuffer(scene) {
        const cascadeInfo = new Float32Array(
            (FDirectionalLight.cascadeInfoSizePerElement / Float32Array.BYTES_PER_ELEMENT) *
                this.params.numCascades
        );
        let offset = 0;
        for (let i = 0; i < this.params.numCascades; i++) {
            const camera = this.cascadeCameras[i];
            // 使用 .elements 确保传入的是 Float32Array
            const viewMatrix = camera.matrixWorldInverse.elements;
            const projectionMatrix = camera.projectionMatrix.elements;
            const sphereCenter = this.#cascadeSpheres[i].center;
            const sphereRadius = this.#cascadeSpheres[i].radius;
            const sphereCenterRadius = [
                sphereCenter.x,
                sphereCenter.y,
                sphereCenter.z,
                sphereRadius,
            ];
            // 将级联分割信息写入一个 vec4：
            // 近边界为 this.#cascades[i]，远边界为 this.#cascades[i+1]
            const cascadeNear = this.#cascades[i];
            const cascadeFar = this.#cascades[i + 1];
            const cascadeDepthData = [cascadeNear, cascadeFar, 0.0, 0.0];
            const lightBiasNormalBias = [
                this.params.cascadeLightBias[i],
                this.params.cascadeNormalBias[i],
                0.0,
                0.0,
            ];

            offset =
                (i * FDirectionalLight.cascadeInfoSizePerElement) / Float32Array.BYTES_PER_ELEMENT;
            cascadeInfo.set(viewMatrix, offset);
            offset += 16;
            cascadeInfo.set(projectionMatrix, offset);
            offset += 16;
            cascadeInfo.set(sphereCenterRadius, offset);
            offset += 4;
            cascadeInfo.set(cascadeDepthData, offset);
            offset += 4;
            cascadeInfo.set(lightBiasNormalBias, offset);
            offset += 4;
        }

        const device = await FResourceManager.GetInstance().GetDevice();
        const buffer = this.cascadeInfoBuffer;
        device.queue.writeBuffer(buffer, 0, cascadeInfo);
    }

    #caculateCascadeCamera(mainCamera) {
        this.splitCascades(mainCamera, this.params.numCascades);
        this.caculateCascadeSizeSphere();
        this.configureCascadeCameras();
    }

    /**
     * Destroys GPU resources associated with DirectLight.
     *
     * @async
     * @returns {Promise<void>}
     */
    async Destroy() {
        FResourceManager.GetInstance().DeleteResource(FDirectionalLight.BufferName);
        FResourceManager.GetInstance().DeleteResource(resourceName.Light.DirectLightShadowMap);
    }

    /**
     * 计算cascade 分级距离
     * @param {THREE.PerspectiveCamera} mainCamera
     * @param {number} numCascades
     */
    splitCascades(mainCamera = this.mainCamera, numCascades = this.params.numCascades) {
        if (!mainCamera) {
            throw new Error('Main camera is required for cascade shadow mapping.');
        }

        const cascades = [];
        const near = mainCamera.near;
        const far = mainCamera.far;

        // 计算每个级联的深度值
        for (let i = 0; i < numCascades + 1; i++) {
            // 采用线性和对数混合的计算方式
            const p = i / numCascades;
            const logDepth = near * Math.pow(far / near, p);
            const linearDepth = near + (far - near) * p;

            // 使用splitThreshold混合两种深度计算方式
            const depth = logDepth * (1 - this.params.splitThreshold) + linearDepth * this.params.splitThreshold;

            // 存储深度值（负值，因为在view space中远离相机的方向是负的）
            cascades.push(-depth);
        }
        this.#cascades = cascades;
    }

    /**
     * 计算cascade区域大小 最小包围球的半径和世界坐标下的球心
     * @returns {void}
     */
    caculateCascadeSizeSphere(
        cascadeArray = this.#cascades,
        mainCamera = this.mainCamera,
        numCascades = this.params.numCascades
    ) {
        const NDCCorners = [
            new THREE.Vector4(-1, -1, -1, 1), // near bottom left
            new THREE.Vector4(1, -1, -1, 1), // near bottom right
            new THREE.Vector4(-1, 1, -1, 1), // near top left
            new THREE.Vector4(1, 1, -1, 1), // near top right
            new THREE.Vector4(-1, -1, 1, 1), // far bottom left
            new THREE.Vector4(1, -1, 1, 1), // far bottom right
            new THREE.Vector4(-1, 1, 1, 1), // far top left
            new THREE.Vector4(1, 1, 1, 1), // far top right
        ];

        this.#cascadeSpheres = [];
        for (let i = 0; i < numCascades; i++) {
            const near = cascadeArray[i];
            const far = cascadeArray[i + 1];

            // 使用正确的投影矩阵转换
            const viewFrustum = [];
            for (let j = 0; j < 8; j++) {
                const corner = NDCCorners[j].clone();
                const viewPos = corner.applyMatrix4(mainCamera.projectionMatrixInverse);
                const depth = j < 4 ? near : far; // 前4个是近平面，后4个是远平面
                const scaledPos = new THREE.Vector3(viewPos.x * depth, viewPos.y * depth, depth);
                viewFrustum.push(scaledPos);
            }
            // 转换级联视椎体到世界空间
            const worldViewFrustum = viewFrustum.map((corner) => {
                const worldPos = corner.clone().applyMatrix4(mainCamera.matrixWorld);
                return worldPos;
            });

            // 计算包围球 通过THREE.SphereGeometry
            const sphere = this.#caculateSphereFromViewFrustum(worldViewFrustum);
            this.#cascadeSpheres.push(sphere);
        }
        //console.log(this.mainCamera.projectionMatrixInverse.elements,'\n',this.mainCamera.matrixWorld.elements);
    }

    /**
     * 实现包围球计算
     * @param {THREE.Vector3[]} worldTrapezoid - 世界空间下的梯形
     * @returns {Object{center: THREE.Vector3, radius: number}} 包围球球心世界坐标，半径
     */
    #caculateSphereFromViewFrustum(worldTrapezoid) {
        if (!worldTrapezoid || worldTrapezoid.length === 0) {
            return { center: new THREE.Vector3(), radius: 0 };
        }

        // Ritter's bounding sphere algorithm

        // Step 1: Pick an arbitrary point from the set.
        const p = worldTrapezoid[0];

        // Find the point q that is farthest from p.
        let q = p;
        let maxDist = 0;
        for (const point of worldTrapezoid) {
            const dist = p.distanceTo(point);
            if (dist > maxDist) {
                maxDist = dist;
                q = point;
            }
        }

        // Step 2: Find the point r that is farthest from q.
        let r = q;
        maxDist = 0;
        for (const point of worldTrapezoid) {
            const dist = q.distanceTo(point);
            if (dist > maxDist) {
                maxDist = dist;
                r = point;
            }
        }

        // Initialize the sphere: center is the midpoint of q and r, radius is half the distance between them.
        const center = new THREE.Vector3().addVectors(q, r).multiplyScalar(0.5);
        let radius = q.distanceTo(r) * 0.5;

        // Step 3: Adjust the sphere to include all points in the worldTrapezoid.
        for (const point of worldTrapezoid) {
            const d = center.distanceTo(point);
            if (d > radius) {
                // If the point is outside the sphere, update the sphere.
                const newRadius = (radius + d) * 0.5;
                // Calculate the required shift for the center.
                const shift = new THREE.Vector3()
                    .subVectors(point, center)
                    .multiplyScalar((d - radius) / (2 * d));
                center.add(shift);
                radius = newRadius;
            }
        }

        return { center, radius };
    }

    /**
     * 配置级联阴影相机参数
     * @param {THREE.PerspectiveCamera} mainCamera - 主相机
     * @param {number} numCascades - 级联数量
     */
    configureCascadeCameras(mainCamera = this.mainCamera, numCascades = this.params.numCascades) {
        if (!this.#cascadeSpheres || this.#cascadeSpheres.length === 0) {
            console.warn('Cascade spheres not calculated yet');
            return;
        }

        for (let i = 0; i < numCascades; i++) {
            const sphere = this.#cascadeSpheres[i];
            const camera = this.cascadeCameras[i];

            // 设置正交相机的视锥体范围
            const radius = sphere.radius;
            camera.left = -radius;
            camera.right = radius;
            camera.top = radius;
            camera.bottom = -radius;

            // 设置近远平面
            const near = this.params.cascadeNear; // 使用一个较小的近平面值
            const far = radius * this.params.farMultiplier + this.params.farOffset; // 远平面设置为半径的3倍 + 固定偏移，确保完全覆盖，并防止低cascade的阴影失真
            camera.near = near;
            camera.far = far;

            // 设置相机位置（在光源方向上偏移）
            const lightDir = this.params.lightDirection.clone().normalize();
            const distanceFromCenter = (near + far) * 0.5;

            // 将相机放置在包围球中心沿光线方向往后的位置
            camera.position.copy(sphere.center).add(lightDir.multiplyScalar(-distanceFromCenter));

            // 让相机看向包围球中心
            camera.lookAt(sphere.center);

            // 更新相机矩阵
            camera.updateProjectionMatrix();
            camera.updateMatrixWorld(true);
        } /*
        console.log(
            this.cascadeCameras.map((camera) => {
                return {
                    left: camera.left,
                    right: camera.right,
                    top: camera.top,
                    bottom: camera.bottom,
                    near: camera.near,
                    far: camera.far,
                    matrixWorld: camera.matrixWorld.elements,
                };
            })
        );

                    this.test.num += 1;
        if (this.test.num === -1) {
            this.cascadeCameras.forEach((camera) => {
                const geometry = new THREE.BoxGeometry(
                    camera.right * 2,
                    camera.top * 2,
                    camera.far - camera.near
                );
                const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
                const mesh = new THREE.Mesh(geometry, material);
                mesh.applyMatrix4(camera.matrixWorld);
                const staticMesh = 
                mesh.position.copy(camera.position);
                this.scene.add(mesh);
            });
        }
            */
    }

    /**
     * Debug：读取并打印DirectionalLight的基本信息缓冲区
     */
    async debugCheckBasicInfo() {
        const device = await FResourceManager.GetInstance().GetDevice();
        const stagingBuffer = device.createBuffer({
            size: FDirectionalLight.baseInfoSize,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        });

        // 复制数据到staging buffer
        const commandEncoder = device.createCommandEncoder();
        commandEncoder.copyBufferToBuffer(
            this.BasicInfoBuffer,
            0,
            stagingBuffer,
            0,
            FDirectionalLight.baseInfoSize
        );
        device.queue.submit([commandEncoder.finish()]);

        // 读取数据
        await stagingBuffer.mapAsync(GPUMapMode.READ);
        const data = new Float32Array(stagingBuffer.getMappedRange());

        // 格式化打印
        console.log('DirectionalLight Basic Info:');
        console.log('  lightDirection:', data.slice(0, 4));
        console.log('  lightColor:', data.slice(4, 8));
        console.log('  lightIntensity:', data[8]);
        console.log('  lightBias:', data[9]);
        console.log('  numCascades:', data[10]);
        console.log('  padding0:', data[11]);
        console.log('  padding1:', data.slice(12, 16));

        stagingBuffer.unmap();
    }

    /**
     * Debug：读取并打印指定级联的信息
     * @param {number} cascadeIndex - 级联索引
     */
    async debugCheckCascadeInfo(cascadeIndex) {
        if (cascadeIndex >= this.params.numCascades) {
            console.error(`Invalid cascade index: ${cascadeIndex}, max is ${this.params.numCascades - 1}`);
            return;
        }

        const device = await FResourceManager.GetInstance().GetDevice();
        const stagingBuffer = device.createBuffer({
            size: FDirectionalLight.cascadeInfoSizePerElement,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        });

        // 复制指定级联的数据到staging buffer
        const commandEncoder = device.createCommandEncoder();
        commandEncoder.copyBufferToBuffer(
            this.cascadeInfoBuffer,
            cascadeIndex * FDirectionalLight.cascadeInfoSizePerElement,
            stagingBuffer,
            0,
            FDirectionalLight.cascadeInfoSizePerElement
        );
        device.queue.submit([commandEncoder.finish()]);

        // 读取数据
        await stagingBuffer.mapAsync(GPUMapMode.READ);
        const data = new Float32Array(stagingBuffer.getMappedRange());

        // 格式化打印
        console.log(`DirectionalLight Cascade[${cascadeIndex}] Info:`);
        console.log('  viewMatrix:', data.slice(0, 16));
        console.log('  projectionMatrix:', data.slice(16, 32));
        console.log('  sphereCenterRadius:', data.slice(32, 36));
        console.log('  cascadeDepth:', data.slice(36, 40));
        console.log('  padding:', data.slice(40, 64));

        stagingBuffer.unmap();
    }

    /**
     * Debug：读取并打印所有级联的信息
     */
    async debugCheckAllCascades() {
        console.log(`Checking all ${this.params.numCascades} cascades:`);
        for (let i = 0; i < this.params.numCascades; i++) {
            await this.debugCheckCascadeInfo(i);
        }
    }

    /**
     * 从UI DirectionalLight更新参数
     * @param {DirectionalLight} uiLight UI端的平行光对象
     */
    UpdateParamsFromUI(uiLight) {
        if (!uiLight || !uiLight.DynamicVariables) {
            console.warn('Invalid UI DirectionalLight object');
            return;
        }

        const uiParams = uiLight.DynamicVariables;

        // 更新基本参数
        this.params.lightDirection.copy(uiParams.lightDirection);
        this.params.color.copy(uiParams.color);
        this.params.intensity = uiParams.intensity;

        // 更新级联阴影参数
        this.params.numCascades = uiParams.numCascades;
        
        // 确保级联数组大小匹配
        if (this.params.cascadeLightBias.length !== uiParams.cascadeLightBias.length) {
            this.params.cascadeLightBias = new Float32Array(uiParams.cascadeLightBias);
            this.params.cascadeNormalBias = new Float32Array(uiParams.cascadeNormalBias);
        } else {
            // 复制数组内容
            this.params.cascadeLightBias.set(uiParams.cascadeLightBias);
            this.params.cascadeNormalBias.set(uiParams.cascadeNormalBias);
        }

        this.params.splitThreshold = uiParams.splitThreshold;
        this.params.size = uiParams.size;
        this.params.cascadeNear = uiParams.cascadeNear;
        this.params.farMultiplier = uiParams.farMultiplier;
        this.params.farOffset = uiParams.farOffset;
        this.params.bShowCascade = uiParams.bShowCascade;

        // 如果级联数量发生变化，需要重新初始化相关资源
        if (this.cascadeCameras.length !== this.params.numCascades) {
            // 重新创建相机数组
            this.cascadeCameras = [];
            for (let i = 0; i < this.params.numCascades; i++) {
                this.cascadeCameras.push(
                    new THREE.OrthographicCamera(
                        -10,
                        10, // 左右
                        10,
                        -10, // 上下
                        0, // near
                        600 // far
                    )
                );
            }
        }

        // 更新GPU资源
        this.update(this.scene);
    }
}
export default FDirectionalLight;
