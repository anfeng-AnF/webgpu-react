/**
 * @interface IGPULight
 * @description Interface for GPU-enabled light objects. All LED lights
 * that require GPU resources should implement methods for initializing,
 * updating, and destroying GPU resources.
 *
 * @property {string} BufferName - The identifier used for the GPU buffer resource.
 * @method Init - Initializes the GPU resources for the light.
 * @method update - Updates the GPU buffer based on the light's current state.
 * @method Destroy - Cleans up and destroys the GPU resources.
 */
class IGPULight {
    constructor() {
        if (new.target === IGPULight) {
            throw new Error("IGPULight is an interface and cannot be instantiated directly.");
        }
    }

    /**
     * Initializes GPU resources for the light.
     * @abstract
     * @returns {Promise<void>}
     */
    async Init() {
        throw new Error("Method 'Init()' must be implemented.");
    }

    /**
     * Updates the GPU buffer with the current state of the light.
     * @abstract
     * @returns {Promise<void>}
     */
    async update() {
        throw new Error("Method 'update()' must be implemented.");
    }

    /**
     * Destroys the GPU resources associated with the light.
     * @abstract
     * @returns {Promise<void>}
     */
    async Destroy() {
        throw new Error("Method 'Destroy()' must be implemented.");
    }
}

export default IGPULight;
