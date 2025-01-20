import { FShader, EShaderType } from './FShader';

/**
 * 像素着色器类
 * 
 * @example
 * // 1. 从代码创建
 * const pixelShader = new FPixelShader(device, {
 *     name: "basicPixel",
 *     code: `
 *         @group(1) @binding(0) var<uniform> material: MaterialUniforms;
 *         @group(1) @binding(1) var albedoTexture: texture_2d<f32>;
 *         @group(1) @binding(2) var normalTexture: texture_2d<f32>;
 *         @group(1) @binding(3) var textureSampler: sampler;
 * 
 *         struct PixelInput {
 *             @location(0) worldPos: vec3f,
 *             @location(1) normal: vec3f,
 *             @location(2) uv: vec2f,
 *         };
 * 
 *         @fragment
 *         fn main(input: PixelInput) -> @location(0) vec4f {
 *             let albedo = textureSample(albedoTexture, textureSampler, input.uv);
 *             let normal = textureSample(normalTexture, textureSampler, input.uv).xyz;
 *             
 *             // 简单的光照计算
 *             let lightDir = normalize(vec3f(1.0, 1.0, 1.0));
 *             let diffuse = max(dot(normal, lightDir), 0.0);
 *             
 *             return vec4f(albedo.rgb * diffuse, albedo.a);
 *         }
 *     `
 * });
 * 
 * // 2. 从文件加载
 * const shader = new FPixelShader(device, { name: "customPixel" });
 * await shader.loadFromFile("/shaders/pixel.wgsl");
 * 
 * // 3. 在渲染管线中使用
 * const pipeline = device.createRenderPipeline({
 *     layout: pipelineLayout,
 *     // ... 顶点着色器配置
 *     fragment: {
 *         module: pixelShader.getResource(),
 *         entryPoint: "main",
 *         targets: [{
 *             format: presentationFormat
 *         }]
 *     }
 * });
 * 
 * @note
 * 1. 像素着色器必须包含 @fragment 入口点（WebGPU仍使用fragment关键字）
 * 2. 输入必须与顶点着色器输出匹配
 * 3. 输出格式必须与渲染目标匹配
 * 4. 绑定组声明必须与管线布局匹配
 */
export class FPixelShader extends FShader {
    constructor(device, desc) {
        super(device, {
            ...desc,
            type: EShaderType.FRAGMENT  // WebGPU内部仍使用fragment
        });
    }
} 