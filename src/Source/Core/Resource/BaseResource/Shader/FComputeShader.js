import { FShader, EShaderType } from './FShader';

/**
 * 计算着色器类
 * 
 * @example
 * // 1. 创建计算着色器
 * const computeShader = new FComputeShader(device, {
 *     name: "particleSimulation",
 *     code: `
 *         @group(0) @binding(0) var<storage, read> inputPositions: array<vec4f>;
 *         @group(0) @binding(1) var<storage, read_write> outputPositions: array<vec4f>;
 *         @group(0) @binding(2) var<uniform> params: SimParams;
 * 
 *         struct SimParams {
 *             deltaTime: f32,
 *             gravity: vec3f,
 *         };
 * 
 *         @compute @workgroup_size(64)
 *         fn main(@builtin(global_invocation_id) id: vec3u) {
 *             let i = id.x;
 *             if (i >= arrayLength(&inputPositions)) { return; }
 * 
 *             var pos = inputPositions[i];
 *             pos.xyz += params.gravity * params.deltaTime;
 *             outputPositions[i] = pos;
 *         }
 *     `
 * });
 * 
 * // 2. 在计算管线中使用
 * const computePipeline = device.createComputePipeline({
 *     layout: pipelineLayout,
 *     compute: {
 *         module: computeShader.getResource(),
 *         entryPoint: "main"
 *     }
 * });
 * 
 * // 3. 调度计算
 * const commandEncoder = device.createCommandEncoder();
 * const computePass = commandEncoder.beginComputePass();
 * computePass.setPipeline(computePipeline);
 * computePass.setBindGroup(0, computeBindGroup);
 * computePass.dispatchWorkgroups(numParticles / 64);
 * computePass.end();
 * 
 * @note
 * 1. 计算着色器必须包含 @compute 入口点
 * 2. 必须指定 workgroup_size
 * 3. 注意存储缓冲区的读写权限
 * 4. 计算管线使用独立的通道
 */
export class FComputeShader extends FShader {
    constructor(device, desc) {
        super(device, {
            ...desc,
            type: EShaderType.COMPUTE
        });
    }
} 