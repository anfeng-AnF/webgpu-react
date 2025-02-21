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
     * @param {THREE.Camera} mainCamera - The main camera. required for cascade shadow mapping.
     * @param {number} numCascades - The number of cascades.
     * @param {number} splitThreshold - The threshold for splitting the cascades split that lerp linear and Logarithmic.default use logarithmic.
     */
    constructor(color, intensity, mainCamera, numCascades = 8, splitThreshold = 0) {
        super(color, intensity);
        // Bias may be used in shadow mapping calculations.
        this.bias = 0.0;
        this.mainCamera = mainCamera;
        this.numCascades = numCascades;
        this.splitThreshold = splitThreshold;

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
                    depth: this.numCascades,
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
        // 从世界矩阵中提取方向向量
        lightDir.setFromMatrixColumn(shadowCamera.matrixWorld, 2);
        lightDir.negate();
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

        this.splitCascades();
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
        const cascadeSpheres = this.caculateCascadeSizeSphere();

        // 计算每个相机的near和far，并设置相机信息
        for(let i = 0; i < numCascades; i++) {
            const near = 1;
            const far = cascadeSpheres[i].radius*2+2e3*i;
            const camera = this.cascadeCameras[i];
            camera.near = near;
            camera.far = far;
            camera.left = -cascadeSpheres[i].radius;
            camera.right = cascadeSpheres[i].radius;
            camera.top = cascadeSpheres[i].radius;
            camera.bottom = -cascadeSpheres[i].radius;
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
