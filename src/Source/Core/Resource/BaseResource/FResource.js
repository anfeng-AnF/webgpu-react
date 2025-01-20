/**
 * GPU资源基类
 * 所有GPU资源的抽象基类，提供基本的资源管理功能
 * 
 * @example
 * // 通常不直接使用FResource，而是使用其子类
 * class FCustomResource extends FResource {
 *     constructor(device, desc) {
 *         super(device, desc);
 *         // 自定义初始化
 *     }
 * 
 *     // 实现必要的抽象方法
 *     create() {
 *         this.gpuResource = this.device.createCustomResource({
 *             // 资源配置
 *         });
 *     }
 * 
 *     getLayout() {
 *         return {
 *             type: 'custom',
 *             // 布局配置
 *         };
 *     }
 * }
 * 
 * @note
 * 1. 子类必须实现create()方法来创建具体的GPU资源
 * 2. 子类必须实现getLayout()方法来提供资源布局信息
 * 3. 资源会在首次使用时自动创建
 * 4. 资源销毁时会自动清理GPU资源
 */
export class FResource {
    /**
     * @param {GPUDevice} device - GPU设备
     * @param {Object} desc - 资源描述符
     * @param {string} desc.name - 资源名称
     */
    constructor(device, desc) {
        this.device = device;
        this.desc = desc;
        this.name = desc.name;
        this.gpuResource = null;
    }

    /**
     * 获取GPU资源，如果未创建则自动创建
     * @returns {Object} GPU资源对象
     */
    getResource() {
        if (!this.gpuResource) {
            if (!this.validateDesc()) {
                throw new Error(`Invalid resource description for ${this.name}`);
            }
            this.create();
        }
        return this.gpuResource;
    }

    /**
     * 创建GPU资源
     * 由子类实现具体创建逻辑
     */
    create() {
        throw new Error('create() must be implemented by subclass');
    }

    /**
     * 销毁GPU资源
     */
    destroy() {
        if (this.gpuResource) {
            if (typeof this.gpuResource.destroy === 'function') {
                this.gpuResource.destroy();
            }
            this.gpuResource = null;
        }
    }

    /**
     * 获取资源布局
     * 由子类实现具体布局获取逻辑
     * @returns {Object} 资源布局描述符
     */
    getLayout() {
        throw new Error('getLayout() must be implemented by subclass');
    }

    /**
     * 验证资源描述符
     * 由子类实现具体验证逻辑
     * @protected
     * @returns {boolean} 验证结果
     */
    validateDesc() {
        // 基类只验证基本属性
        return (
            this.device &&
            this.desc &&
            typeof this.desc === 'object' &&
            typeof this.name === 'string'
        );
    }

    /**
     * 获取资源名称
     * @returns {string} 资源名称
     */
    getName() {
        return this.name;
    }

    /**
     * 获取资源描述符
     * @returns {Object} 资源描述符
     */
    getDesc() {
        return this.desc;
    }

    /**
     * 检查资源是否已创建
     * @returns {boolean} 是否已创建
     */
    isCreated() {
        return this.gpuResource !== null;
    }
}
