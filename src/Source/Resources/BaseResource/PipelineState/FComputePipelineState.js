import { FPipelineState } from './FPipelineState';

/**
 * 计算管线状态描述符
 * @typedef {Object} ComputePipelineStateDescriptor
 * @property {string} computeShader - 计算着色器代码
 * @property {number[]} [workgroupSize=[1,1,1]] - 工作组大小
 */

/**
 * 计算管线状态类
 */
export class FComputePipelineState extends FPipelineState {
    /**
     * @param {GPUDevice} device - GPU设备
     * @param {Object} desc - 计算管线状态描述符
     * @param {string} [desc.name] - 资源名称
     * @param {PipelineLayoutDescriptor} desc.layout - 管线布局描述符
     * @param {ComputePipelineStateDescriptor} desc.compute - 计算管线状态描述符
     */
    constructor(device, desc) {
        super(device, desc);

        /**
         * 计算管线状态描述符
         * @type {ComputePipelineStateDescriptor}
         * @private
         */
        this._computeDesc = desc.compute;

        /**
         * 工作组大小
         * @type {number[]}
         * @readonly
         */
        this.workgroupSize = desc.compute.workgroupSize ?? [1, 1, 1];
    }

    /**
     * 创建具体的管线
     * @protected
     * @override
     * @returns {Promise<void>}
     */
    async _createPipeline() {
        const computeState = {
            module: this.device.createShaderModule({
                code: this._computeDesc.computeShader
            }),
            entryPoint: 'main',
            constants: {
                workgroupSizeX: this.workgroupSize[0],
                workgroupSizeY: this.workgroupSize[1],
                workgroupSizeZ: this.workgroupSize[2]
            }
        };

        this._gpuPipeline = this.device.createComputePipeline({
            layout: this.getGPUPipelineLayout(),
            compute: computeState
        });
    }

    /**
     * 获取工作组大小
     * @returns {number[]} [x, y, z]
     */
    getWorkgroupSize() {
        return [...this.workgroupSize];
    }

    /**
     * 计算工作组数量
     * @param {number[]} totalSize - 总计算大小 [x, y, z]
     * @returns {number[]} 工作组数量 [x, y, z]
     */
    calculateWorkgroups(totalSize) {
        return totalSize.map((size, i) => 
            Math.ceil(size / this.workgroupSize[i])
        );
    }
} 