import { FRenderResource } from '../FRenderResource';
import { FBindGroupLayout } from '../BindGroup/FBindGroupLayout';

/**
 * 管线布局描述符
 * @typedef {Object} PipelineLayoutDescriptor
 * @property {FBindGroupLayout[]} bindGroupLayouts - 绑定组布局数组
 * @property {boolean} [pushConstant=false] - 是否使用推送常量
 */

/**
 * 管线状态基类
 */
export class FPipelineState extends FRenderResource {
    /**
     * @param {GPUDevice} device - GPU设备
     * @param {Object} desc - 管线状态描述符
     * @param {string} [desc.name] - 资源名称
     * @param {PipelineLayoutDescriptor} desc.layout - 管线布局描述符
     */
    constructor(device, desc) {
        super(device, desc.name);

        /**
         * 绑定组布局数组
         * @type {FBindGroupLayout[]}
         * @readonly
         */
        this.bindGroupLayouts = desc.layout.bindGroupLayouts;

        /**
         * 是否使用推送常量
         * @type {boolean}
         * @readonly
         */
        this.pushConstant = desc.layout.pushConstant ?? false;

        /**
         * GPU管线布局对象
         * @type {GPUPipelineLayout}
         * @private
         */
        this._gpuPipelineLayout = null;

        /**
         * GPU管线对象
         * @type {GPUPipeline}
         * @protected
         */
        this._gpuPipeline = null;

        // 创建管线布局
        this._createPipelineLayout();
    }

    /**
     * 创建GPU管线布局
     * @private
     */
    _createPipelineLayout() {
        const bindGroupLayouts = this.bindGroupLayouts.map(layout => 
            layout.getGPUBindGroupLayout()
        );

        this._gpuPipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts,
            pushConstantRanges: this.pushConstant ? [{
                stages: 0x7, // VERTEX | FRAGMENT | COMPUTE
                start: 0,
                end: 256 // 最大推送常量大小
            }] : []
        });
    }

    /**
     * 获取GPU管线布局对象
     * @returns {GPUPipelineLayout}
     */
    getGPUPipelineLayout() {
        return this._gpuPipelineLayout;
    }

    /**
     * 获取GPU管线对象
     * @returns {GPUPipeline}
     */
    getGPUPipeline() {
        return this._gpuPipeline;
    }

    /**
     * 销毁资源
     * @override
     */
    destroy() {
        this._gpuPipelineLayout = null;
        this._gpuPipeline = null;
        super.destroy();
    }
} 