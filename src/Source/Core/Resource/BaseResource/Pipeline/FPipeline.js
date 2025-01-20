import { FResource } from '../FResource';

/**
 * 管线类型枚举
 * @enum {string}
 */
export const EPipelineType = {
    RENDER: 'render',
    COMPUTE: 'compute'
};

/**
 * 管线基类
 * 管理渲染和计算管线的创建和配置
 * 
 * @example
 * // 通常不直接使用FPipeline，而是使用其子类
 * class FCustomPipeline extends FPipeline {
 *     constructor(device, desc) {
 *         super(device, {
 *             ...desc,
 *             type: EPipelineType.RENDER
 *         });
 *     }
 * }
 * 
 * @note
 * 1. 提供管线基本配置管理
 * 2. 自动处理管线布局创建
 * 3. 支持动态更新管线状态
 * 4. 子类需要实现具体的管线创建逻辑
 */
export class FPipeline extends FResource {
    /**
     * @param {GPUDevice} device - GPU设备
     * @param {Object} desc - 管线描述符
     * @param {string} desc.name - 资源名称
     * @param {EPipelineType} desc.type - 管线类型
     * @param {Array<GPUBindGroupLayout>} [desc.bindGroupLayouts=[]] - 绑定组布局数组
     */
    constructor(device, desc) {
        super(device, desc);
        
        this.type = desc.type;
        this.bindGroupLayouts = desc.bindGroupLayouts || [];
        this.pipelineLayout = null;
    }

    /**
     * 创建管线布局
     * @protected
     */
    createLayout() {
        this.pipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: this.bindGroupLayouts
        });
    }

    /**
     * 获取管线布局
     * @returns {GPUPipelineLayout} 管线布局
     */
    getLayout() {
        if (!this.pipelineLayout) {
            this.createLayout();
        }
        return this.pipelineLayout;
    }

    /**
     * 设置绑定组布局
     * @param {Array<GPUBindGroupLayout>} layouts - 绑定组布局数组
     */
    setBindGroupLayouts(layouts) {
        this.bindGroupLayouts = layouts;
        this.pipelineLayout = null;  // 使当前布局失效
        this.gpuResource = null;     // 使管线失效
    }
} 