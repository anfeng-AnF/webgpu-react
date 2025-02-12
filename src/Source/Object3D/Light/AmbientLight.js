import * as THREE from "three";
import FResourceManager from "../../Core/Resource/FResourceManager";
import IGPULight from "./IGPULight";

/**
 * Represents an ambient light with GPU resource management.
 * Implements the IGPULight interface to handle GPU buffer creation,
 * updating, and destruction.
 *
 * Ambient Light Buffer Layout (total 32 bytes):
 *   ambientColor:       vec4<f32>    16 bytes, offset 0 - 15 bytes (0 - 127 bit)
 *   ambientIntensity:   f32          4 bytes,  offset 16 - 19 bytes (128 - 159 bit)
 *   padding:            vec3<f32>    12 bytes, offset 20 - 31 bytes (160 - 255 bit)
 *
 * @class AmbientLight
 * @extends THREE.AmbientLight
 * @implements IGPULight
 */
class AmbientLight extends THREE.AmbientLight {

    /**
     * 环境光缓冲区
     * @type {GPUBuffer}
     */
    buffer = null;

    /**
     * Creates an instance of AmbientLight.
     * @param {THREE.Color | number | string} color - The color of the ambient light.
     * @param {number} intensity - The intensity of the ambient light.
     */
    constructor(color, intensity) {
        super(color, intensity);
    }

    /**
     * Initializes GPU resources for the AmbientLight.
     *
     * @async
     * @returns {Promise<void>}
     */
    async Init() {
        const AmbientLightBufferDesc = {
            Type: 'Buffer',
            desc: {
                size: 32, // 32 bytes total
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            },
        };

        this.buffer = FResourceManager.GetInstance().CreateResource(
            AmbientLight.BufferName,
            AmbientLightBufferDesc
        );
    }

    /**
     * Updates the GPU buffer of AmbientLight with the current light properties.
     *
     * @async
     * @returns {Promise<void>}
     */
    async update() {
        const resourceManager = FResourceManager.GetInstance();
        // Initialize GPU resource if it does not exist.
        if (!resourceManager.GetResource(AmbientLight.BufferName)) {
            await this.Init();
        }

        // Prepare data to upload (8 floats = 32 bytes).
        const data = new Float32Array(8);
        let offset = 0;

        // Write ambientColor (as vec4: r, g, b, a=1.0)
        data.set([this.color.r, this.color.g, this.color.b, 1.0], offset);
        offset += 4;

        // Write ambientIntensity (f32)
        data[offset++] = this.intensity;

        // Write padding (vec3<f32>)
        data[offset++] = 0.0;
        data[offset++] = 0.0;
        data[offset++] = 0.0;

        // Update the GPU buffer with the new data.
        const device = await resourceManager.GetDevice();
        const buffer = resourceManager.GetResource(AmbientLight.BufferName);
        device.queue.writeBuffer(buffer, 0, data);
    }

    /**
     * Destroys the GPU resources associated with AmbientLight.
     *
     * @async
     * @returns {Promise<void>}
     */
    async Destroy() {
        FResourceManager.GetInstance().DeleteResource(AmbientLight.BufferName);
    }
}

/**
 * The GPU Buffer name for AmbientLight.
 * @type {string}
 */
AmbientLight.BufferName = 'AmbientLightBuffer';

export default AmbientLight;
