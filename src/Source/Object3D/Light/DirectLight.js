import * as THREE from 'three';
import FResourceManager from '../../Core/Resource/FResourceManager';
import { resourceName } from '../../Renderer/DeferredShadingRenderer/ResourceNames';
import IGPULight from './IGPULight';
import GPUScene from '../../Scene/GPUScene';
import FModuleManager from '../../Core/FModuleManager';

/**
 * Represents a directional light with GPU resource management.
 * Implements the IGPULight interface to handle GPU buffer creation,
 * updating, and destruction.
 *
 * Buffer Layout (total 192 bytes):
 *   viewMatrix:        mat4x4<f32>   64 bytes, offset 0 - 63 bytes  (0 - 511 bit)
 *   projectionMatrix:  mat4x4<f32>   64 bytes, offset 64 - 127 bytes (512 - 1023 bit)
 *   lightPosition:     vec4<f32>     16 bytes, offset 128 - 143 bytes (1024 - 1151 bit)
 *   lightDirection:    vec4<f32>     16 bytes, offset 144 - 159 bytes (1152 - 1279 bit)
 *   lightColor:        vec4<f32>     16 bytes, offset 160 - 175 bytes (1280 - 1407 bit)
 *   lightIntensity:    f32           4 bytes,  offset 176 - 179 bytes (1408 - 1439 bit)
 *   lightBias:         f32           4 bytes,  offset 180 - 183 bytes (1440 - 1471 bit)
 *   padding:           vec2<f32>     8 bytes,  offset 184 - 191 bytes (1472 - 1535 bit)
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
    buffer = null;

    /**
     * 平行光阴影贴图
     * @type {GPUTexture}
     */
    shadowMap = null;

    /**
     * Creates an instance of DirectLight.
     * @param {THREE.Color | number | string} color - The light color.
     * @param {number} intensity - The light intensity.
     */
    constructor(color, intensity) {
        super(color, intensity);
        // Bias may be used in shadow mapping calculations.
        this.bias = 0.0;
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
                size: 192, // 192 bytes, following the layout above.
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            },
        };

        this.buffer = FResourceManager.GetInstance().CreateResource(
            DirectLight.BufferName,
            DirectLightBufferDesc
        );

        // Create shadow map texture resource.
        const shadowMapDesc = {
            Type: 'Texture',
            desc: {
                size: {
                    width: 1024,
                    height: 1024,
                },
                format: 'rgba16float',
                usage:
                    GPUTextureUsage.RENDER_ATTACHMENT |
                    GPUTextureUsage.COPY_DST |
                    GPUTextureUsage.TEXTURE_BINDING |
                    GPUTextureUsage.COPY_SRC,
                sampleCount: 1,
                mipLevelCount: 4,
            },
        };

        this.shadowMap = FResourceManager.GetInstance().CreateResource(
            resourceName.Light.DirectLightShadowMap,
            shadowMapDesc
        );


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
        this.position.set(20, 66,66);
        // 创建固定大小的正交相机用于测试
        const shadowCamera = new THREE.OrthographicCamera(
            -3, 3,    // 左右
            3, -3,    // 上下
            0.1,      // near
            100       // far
        );

        // 设置阴影相机位置和方向
        shadowCamera.position.copy(this.position);
        shadowCamera.lookAt(0, 0, 0);
        shadowCamera.updateMatrixWorld();
        shadowCamera.updateProjectionMatrix();

        // 计算视图矩阵
        const viewMatrix = new THREE.Matrix4();
        viewMatrix.copy(shadowCamera.matrixWorld).invert();

        // 获取投影矩阵
        const projectionMatrix = shadowCamera.projectionMatrix;

        // 打包数据到 Float32Array (48 floats = 192 bytes)
        const data = new Float32Array(48);
        let offset = 0;

        // 写入 viewMatrix (16 floats, 64 bytes)
        viewMatrix.toArray(data, offset);
        offset += 16;

        // 写入 projectionMatrix (16 floats, 64 bytes)
        projectionMatrix.toArray(data, offset);
        offset += 16;

        // 写入 lightPosition (vec4, 16 bytes)
        data.set([this.position.x, this.position.y, this.position.z, 1.0], offset);
        offset += 4;

        // 写入 lightDirection (vec4, 16 bytes)
        const lightDir = new THREE.Vector3();
        this.getWorldDirection(lightDir);
        data.set([lightDir.x, lightDir.y, lightDir.z, 0.0], offset);
        offset += 4;

        // 写入 lightColor (vec4, 16 bytes)
        data.set([this.color.r, this.color.g, this.color.b, 1.0], offset);
        offset += 4;

        // 写入 lightIntensity (f32, 4 bytes)
        data[offset++] = this.intensity;

        // 写入 lightBias (f32, 4 bytes)
        data[offset++] = this.bias;

        // 写入 padding (vec2<f32>, 8 bytes)
        data[offset++] = 0.0;
        data[offset++] = 0.0;

        // 上传缓冲区到 GPU
        const device = await resourceManager.GetDevice();
        const buffer = resourceManager.GetResource(DirectLight.BufferName);
        device.queue.writeBuffer(buffer, 0, data);
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
}

export default DirectLight;
