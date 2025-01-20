import { FPipeline, EPipelineType } from './FPipeline';

/**
 * 计算管线类
 * 
 * @example
 * // 1. 使用默认入口点创建计算管线
 * const computePipeline = new FComputePipeline(device, {
 *     name: "particleSimulation",
 *     compute: {
 *         module: computeShader.getResource()
 *         // 默认使用 "ComputeMain" 作为入口点
 *     }
 * });
 * 
 * // 2. 自定义入口点
 * const customPipeline = new FComputePipeline(device, {
 *     name: "customCompute",
 *     compute: {
 *         module: computeShader.getResource(),
 *         entryPoint: "main"  // 自定义入口点
 *     }
 * });
 * 
 * // 3. 在计算通道中使用
 * const computePass = commandEncoder.beginComputePass();
 * computePass.setPipeline(computePipeline.getResource());
 * computePass.setBindGroup(0, computeBindGroup);  // 绑定组由外部系统管理
 * computePass.dispatchWorkgroups(numParticles / 64);  // 工作组数量
 * computePass.end();
 * 
 * @note
 * 1. 计算管线配置一旦创建就不可更改
 * 2. 绑定组布局必须与计算着色器声明匹配
 * 3. 工作组大小必须与着色器中的 workgroup_size 匹配
 * 4. 默认入口点为 "ComputeMain"
 * 5. 绑定组布局通常由资源管理系统提供
 */
export class FComputePipeline extends FPipeline {
    /**
     * @param {GPUDevice} device - GPU设备
     * @param {Object} desc - 计算管线描述符
     * @param {string} desc.name - 资源名称
     * @param {Array<GPUBindGroupLayout>} [desc.bindGroupLayouts=[]] - 绑定组布局数组
     * @param {Object} desc.compute - 计算着色器配置
     * @param {GPUShaderModule} desc.compute.module - 计算着色器模块
     * @param {string} [desc.compute.entryPoint="ComputeMain"] - 入口点函数名
     */
    constructor(device, desc) {
        super(device, {
            ...desc,
            type: EPipelineType.COMPUTE
        });

        // 设置计算状态，确保有默认入口点
        this.computeState = {
            ...desc.compute,
            entryPoint: desc.compute.entryPoint || "ComputeMain"
        };
    }

    /**
     * 创建计算管线
     * @protected
     */
    create() {
        this.gpuResource = this.device.createComputePipeline({
            layout: this.getLayout(),
            compute: this.computeState
        });
    }
} 