import { FShader, EShaderType } from './FShader';

/**
 * 顶点着色器类
 * 
 * @example
 * // 1. 从代码创建
 * const vertexShader = new FVertexShader(device, {
 *     name: "basicVertex",
 *     code: `
 *         @group(0) @binding(0) var<uniform> transform: TransformUniforms;
 * 
 *         struct VertexInput {
 *             @location(0) position: vec3f,
 *             @location(1) normal: vec3f,
 *             @location(2) uv: vec2f,
 *         };
 * 
 *         struct VertexOutput {
 *             @builtin(position) position: vec4f,
 *             @location(0) worldPos: vec3f,
 *             @location(1) normal: vec3f,
 *             @location(2) uv: vec2f,
 *         };
 * 
 *         @vertex
 *         fn main(input: VertexInput) -> VertexOutput {
 *             var output: VertexOutput;
 *             output.position = transform.projectionMatrix * 
 *                             transform.viewMatrix * 
 *                             transform.modelMatrix * 
 *                             vec4f(input.position, 1.0);
 *             output.worldPos = (transform.modelMatrix * vec4f(input.position, 1.0)).xyz;
 *             output.normal = normalize((transform.modelMatrix * vec4f(input.normal, 0.0)).xyz);
 *             output.uv = input.uv;
 *             return output;
 *         }
 *     `
 * });
 * 
 * // 2. 从文件加载
 * const shader = new FVertexShader(device, { name: "customVertex" });
 * await shader.loadFromFile("/shaders/vertex.wgsl");
 * 
 * // 3. 在渲染管线中使用
 * const pipeline = device.createRenderPipeline({
 *     layout: pipelineLayout,
 *     vertex: {
 *         module: vertexShader.getResource(),
 *         entryPoint: "main",
 *         buffers: [vertexBuffer.getLayout()]
 *     },
 *     // ... 其他配置
 * });
 * 
 * @note
 * 1. 顶点着色器必须包含 @vertex 入口点
 * 2. 输入属性必须与顶点缓冲区布局匹配
 * 3. 绑定组声明必须与管线布局匹配
 */
export class FVertexShader extends FShader {
    constructor(device, desc) {
        super(device, {
            ...desc,
            type: EShaderType.VERTEX
        });
    }
} 