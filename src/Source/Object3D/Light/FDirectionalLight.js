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
 *   viewMatrix:        mat4x4<f32>   64 bytes, offset --- - --- bytes     removed
 *   projectionMatrix:  mat4x4<f32>   64 bytes, offset --- - --- bytes   removed
 *   lightPosition:     vec4<f32>     16 bytes, offset --- - --- bytes   removed
 *   lightDirection:    vec4<f32>     16 bytes, offset 0  - 15 bytes 
 *   lightColor:        vec4<f32>     16 bytes, offset 16 - 31 bytes 
 *   lightIntensity:    f32           4 bytes,  offset 32 - 35 bytes 
 *   lightBias:         f32           4 bytes,  offset 36 - 39 bytes
 *   padding:           f32array[6]   24 bytes, offset 40 - 63 bytes 
 *
 * cascade buffer layout (storage buffer)
 *  preArrayElementLayout:{
 *      viewMatrix:             mat4x4<f32>   64 bytes, offset 0   - 63  bytes
 *      projectionMatrix:       mat4x4<f32>   64 bytes, offset 64  - 127 bytes
 *      sphereCenter+Radius:    vec4<f32>     16 bytes, offset 128 - 143 bytes xyz for world position, w for radius
 *      padding:                f32array[12]  48 bytes, offset 144 - 191 bytes
 *  }
 * 
 * @class DirectLight
 * @extends THREE.DirectionalLight
 * @implements IGPULight
 */
class DirectLight extends THREE.DirectionalLight {
    /**
     * 平行光缓冲区
     * @type {GPUBuffer}
     */
    BasicInfoBuffer = null;

    /**
     * 平行光阴影贴图
     * @type {GPUTexture}
     */
    shadowMap = null;

    static cascadeInfoSizePerElement = 64*3;
    static baseInfoSize = 64;

    /**
     * Creates an instance of DirectLight.
     * @param {THREE.Color | number | string} color - The light color.
     * @param {number} intensity - The light intensity.
     * @param {THREE.Camera} mainCamera - The main camera. required for cascade shadow mapping.
     * @param {number} numCascades - The number of cascades.
     * @param {number} splitThreshold - The threshold for splitting the cascades split that lerp linear and Logarithmic.default use logarithmic.
     * @param {number} size - The size of the shadow map.
     */
    constructor(color, intensity, mainCamera, numCascades = 8, splitThreshold = 0, size = 1024) {
        super(color, intensity);
        // Bias may be used in shadow mapping calculations.
        this.bias = 0.0;
        this.mainCamera = mainCamera;
        this.numCascades = numCascades;
        this.splitThreshold = splitThreshold;
        this.size = size;
        /**
         * 初始化cascade相机
         * @type {THREE.OrthographicCamera[]}
         */
        this.cascadeCameras = [];
        // 创建numCascades个相机
        for(let i = 0; i < numCascades; i++) {
            this.cascadeCameras.push(new THREE.OrthographicCamera(
                -10, 10,    // 左右
                10, -10,    // 上下
                0,      // near
                600       // far
            ));
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
     */
    async Init() {
        const DirectLightBufferDesc = {
            Type: 'Buffer',
            desc: {
                size: DirectLight.baseInfoSize,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            },
        };

        this.cascadeInfoBuffer = await FResourceManager.GetInstance().CreateResource(
            'CascadeInfoBuffer',
            {
                Type: 'Buffer',
                desc: {
                    size: DirectLight.cascadeInfoSizePerElement*this.numCascades,
                    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
                },
            }
        );

        this.BasicInfoBuffer = await FResourceManager.GetInstance().CreateResource(
            DirectLight.BufferName,
            DirectLightBufferDesc
        );

        // Create shadow map texture resource.
        const shadowMapDesc = {
            Type: 'Texture',
            desc: {
                size: {
                    width: this.size,
                    height: this.size,
                    depth: this.numCascades,
                },
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

        this.shadowMap = FResourceManager.GetInstance().CreateResource(
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
                        }
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
                                size: DirectLight.cascadeInfoSizePerElement,
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
                        FResourceManager.GetInstance().GetResource(resourceName.Scene.sceneBindGroupLayout),
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
                    code: await ShaderIncluder.GetShaderCode('/Shader/LightPass/CascadeShadowMap.wgsl'),
                },
            }
        );  

        const pipeline = await FResourceManager.GetInstance().CreateResource(
            'DirectLightPipeline',
            {
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
                    },
                },
            }
        );
    }

    /**
     * 渲染阴影贴图
     * @param {number} deltaTime - 时间
     * @param {GPUScene} Scene - 场景
     * @param {GPUCommandEncoder} commandEncoder - 命令编码器
     * @param {Renderer} renderer - 渲染器
     */
    renderShadowMap(deltaTime, Scene, commandEncoder, renderer) {
        for(let i = 0; i < this.numCascades; i++) {
            const renderPassDesc = {
                colorAttachments: [],
                depthStencilAttachment: {
                    view: this.shadowMap.createView({
                        dimension: '2d-array',
                        arrayLayerCount: 1,
                        baseArrayLayer: i,
                    }),
                    depthClearValue: 1.0,
                },
            };
            const passEncoder = commandEncoder.beginRenderPass(renderPassDesc);
            passEncoder.setPipeline(this.pipeline);

            const meshes = Scene.GetAllMesh();
            for (const mesh of meshes) {
                const dynamicOffset = Scene.getMeshOffset(mesh.uuid);
                passEncoder.setBindGroup(0, Scene.sceneBindGroup, [dynamicOffset]);
                passEncoder.setBindGroup(1, this.lightBindGroup, [this.cascadeInfoSizePerElement*i]);
    
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
        // 更新世界矩阵
        this.updateMatrixWorld(true);

        const resourceManager = FResourceManager.GetInstance();
        // 检查GPU资源是否存在，如果不存在则初始化
        if (!(resourceManager.GetResource(DirectLight.BufferName) && 
              resourceManager.GetResource(resourceName.Light.DirectLightShadowMap))) {
            await this.Init();
        }

        // 设置固定的测试位置和方向
        this.lookAt(0, 0, 0); // 看向原点
        this.position.set(100,200,200);
        // 创建固定大小的正交相机用于测试
        const shadowCamera = new THREE.OrthographicCamera(
            -10, 10,    // 左右
            10, -10,    // 上下
            0,      // near
            600       // far
        );

        // 设置阴影相机位置和方向
        shadowCamera.position.set(100,200,200);
        shadowCamera.lookAt(0, 0, 0);
        shadowCamera.updateMatrixWorld();
        shadowCamera.updateProjectionMatrix();

        // 视图矩阵
        const viewMatrix = new THREE.Matrix4();
        viewMatrix.copy(shadowCamera.matrixWorldInverse);

        // 获取投影矩阵
        const projectionMatrix = shadowCamera.projectionMatrix;

        // 打包数据到 Float32Array (16 floats = 64 bytes)
        const data = new Float32Array(DirectLight.baseInfoSize/Float32Array.BYTES_PER_ELEMENT);
        let offset = 0;
        // 写入 lightDirection (vec4, 16 bytes)
        const lightDir = new THREE.Vector3();
        // 从世界矩阵中提取方向向量
        lightDir.setFromMatrixColumn(shadowCamera.matrixWorld, 2);
        this.lightDirection = lightDir.negate();
        data.set([lightDir.x, lightDir.y, lightDir.z, 0.0], offset);
        offset += 4;
        // 写入 lightColor (vec4, 16 bytes)
        data.set([this.color.r, this.color.g, this.color.b, 1.0], offset);
        offset += 4;

        // 写入 lightIntensity (f32, 4 bytes)
        data[offset++] = this.intensity;

        // 写入 lightBias (f32, 4 bytes)
        data[offset++] = this.bias;

        // 上传缓冲区到 GPU
        const device = await resourceManager.GetDevice();
        const buffer = this.BasicInfoBuffer;
        device.queue.writeBuffer(buffer, 0, data);

        this.splitCascades();

        // 更新cascade信息
        const cascadeInfo = new Float32Array(DirectLight.cascadeInfoSizePerElement/Float32Array.BYTES_PER_ELEMENT*this.numCascades);
        offset = 0;
        for(let i = 0; i < this.numCascades; i++) {
            const camera = this.cascadeCameras[i];
            const viewMatrix = camera.matrixWorldInverse;
            const projectionMatrix = camera.projectionMatrix;
            const sphereCenter = this.cascadeSpheres[i].center;
            const sphereRadius = this.cascadeSpheres[i].radius;
            const centerRadius = new THREE.Vector4(sphereCenter.x, sphereCenter.y, sphereCenter.z, sphereRadius);
            const padding = new Float32Array(12);

            cascadeInfo.set(viewMatrix.toArray(), offset);
            offset += 16;
            cascadeInfo.set(projectionMatrix.toArray(), offset);
            offset += 16;
            cascadeInfo.set(centerRadius.toArray(), offset);
            offset += 4;    
            cascadeInfo.set(padding, offset);
            offset += 12;
        }   
        device.queue.writeBuffer(this.cascadeInfoBuffer, 0, cascadeInfo);
    }

    /**
     * Destroys GPU resources associated with DirectLight.
     *
     * @async
     * @returns {Promise<void>}
     */
    async Destroy() {
        FResourceManager.GetInstance().DeleteResource(DirectLight.BufferName);
        FResourceManager.GetInstance().DeleteResource(resourceName.Light.DirectLightShadowMap);
    }

    splitCascades(mainCamera = this.mainCamera, numCascades = this.numCascades) {
        if (!mainCamera) {
            throw new Error('Main camera is required for cascade shadow mapping.');
        }
        // 根据near和far计算出每个cascade的z范围
        this.cascades = [];
        const near = mainCamera.near;
        const far = mainCamera.far;
        for(let i = 0; i < numCascades+1; i++) {
            // 采用线性+指数混合的计算方式
            let logz = near*Math.pow(far/near, i/numCascades);
            let linearz = near + (far - near)*i/numCascades;
            let z = logz*(1-this.splitThreshold) + linearz*this.splitThreshold;
            this.cascades.push(z);
        }
        this.cascadeSpheres = this.caculateCascadeSizeSphere();

        // 计算每个相机的near和far，并设置相机信息
        for(let i = 0; i < numCascades; i++) {
            const near = 1;
            const far = this.cascadeSpheres[i].radius*2+2e3*i;
            const camera = this.cascadeCameras[i];
            camera.near = near;
            camera.far = far;
            camera.left = -this.cascadeSpheres[i].radius;
            camera.right = this.cascadeSpheres[i].radius;
            camera.top = this.cascadeSpheres[i].radius;
            camera.bottom = -this.cascadeSpheres[i].radius;

            // 计算相机位置
            let cameraPos = new THREE.Vector3(
                this.cascadeSpheres[i].center.x,
                this.cascadeSpheres[i].center.y,
                this.cascadeSpheres[i].center.z
            );
            cameraPos.addVectors(cameraPos, this.lightDirection.negate().multiplyScalar(far+near));
            camera.position.copy(cameraPos);
            
            camera.updateProjectionMatrix();
            camera.updateMatrixWorld();
        }
    }

    /**
     * 计算cascade区域大小 最大包围球
     */
    caculateCascadeSizeSphere(cascadeArray = this.cascades, mainCamera = this.mainCamera, numCascades = this.numCascades) {
        const cascadeSpheres = [];
        const projectMatrixInverse = mainCamera.projectionMatrixInverse;
        const viewMatrix = mainCamera.matrixWorld;
        const far = mainCamera.far;
        const near = mainCamera.near;
        const total = near + far;
        const viewFrustum = [
            new THREE.Vector4(1, 1, -1, 1),//near top right
            new THREE.Vector4(-1, -1, -1, 1),//near bottom left
            new THREE.Vector4(1, 1, 1, 1),//far top right
            new THREE.Vector4(-1, -1, 1, 1),//far bottom left
        ];
        const viewPos = viewFrustum.map(v => {
            v.applyMatrix4(projectMatrixInverse);
            return new THREE.Vector3(v.x/v.w, v.y/v.w, v.z/v.w);
        });
        const NTR = viewPos[0];
        const NTL = viewPos[1];
        const FTR = viewPos[2];
        const FTL = viewPos[3];
        for(let i = 0; i < numCascades; i++) {
            //通过z和total比值插值计算当前cascade的ntr,ntl,ftr,ftl
            const zNear = cascadeArray[i];
            const zFar = cascadeArray[i+1];
            const ntr = new THREE.Vector3(
                THREE.MathUtils.lerp(NTR.x, FTR.x, zNear/total),
                THREE.MathUtils.lerp(NTR.y, FTR.y, zNear/total),
                zNear
            );
            const ntl = new THREE.Vector3(
                THREE.MathUtils.lerp(NTL.x, FTL.x, zNear/total),
                THREE.MathUtils.lerp(NTL.y, FTL.y, zNear/total),
                zNear
            );  
            const ftr = new THREE.Vector3(
                THREE.MathUtils.lerp(NTR.x, FTR.x, zFar/total),
                THREE.MathUtils.lerp(NTR.y, FTR.y, zFar/total),
                zFar
            );
            const ftl = new THREE.Vector3(
                THREE.MathUtils.lerp(NTL.x, FTL.x, zFar/total),
                THREE.MathUtils.lerp(NTL.y, FTL.y, zFar/total),
                zFar
            );
            const center = new THREE.Vector3(
                (ntr.x + ftr.x + ntl.x + ftl.x)/4,
                (ntr.y + ftr.y + ntl.y + ftl.y)/4,
                (ntr.z + ftr.z + ntl.z + ftl.z)/4
            );
            const radius = [ntr,ntl,ftr,ftl].map(v => v.distanceTo(center)).reduce((a,b) => Math.max(a,b),0);
            cascadeSpheres.push({center:center.applyMatrix4(viewMatrix),radius:radius});
        }
        return cascadeSpheres;
    }
}
export default DirectLight;
