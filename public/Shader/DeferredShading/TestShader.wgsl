#include "SceneData.wgsh"


struct Uniforms {
    mvpMatrix : mat4x4<f32>,
    modelMatrix : mat4x4<f32>,
};
//@binding(0) @group(0) var<uniform> uniforms : Uniforms;
struct VertexInput {
    @location(0) position : vec3<f32>,
    @location(1) normal : vec3<f32>,
    @location(2) tangent : vec3<f32>,
    @location(3) uv0 : vec2<f32>,
    @location(4) uv1 : vec2<f32>,
    @location(5) uv2 : vec2<f32>,
    @location(6) uv3 : vec2<f32>,
};
struct VertexOutput {
    @builtin(position) position : vec4<f32>,
    @location(0) worldNormal : vec3<f32>,
};
@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
    var output : VertexOutput;
    
    // 计算 MVP 矩阵
    let mvp = GetMVPMatrix();
    
    // 变换位置到裁剪空间
    output.position = mvp * vec4<f32>(input.position, 1.0);
    
    // 变换法线到世界空间
    // 使用 model 矩阵变换法线，不需要平移分量
    output.worldNormal = normalize((matrices.model * vec4<f32>(input.normal, 0.0)).xyz);
    
    return output;
}
@fragment
fn fs_main(@location(0) worldNormal : vec3<f32>) -> @location(0) vec4<f32> {
    // 世界空间法线已经是单位向量，直接映射到颜色空间
    let color = worldNormal * 0.5 + 0.5;
    return vec4<f32>(color, 1.0);
}
            