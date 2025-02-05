#include "../Common/SceneBuffer.wgsh"
#include "../Common/MeshInfo.wgsh"

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) tangent: vec3<f32>,
    @location(3) uv0: vec2<f32>,
    @location(4) uv1: vec2<f32>,
    @location(5) uv2: vec2<f32>,
    @location(6) uv3: vec2<f32>,
}

@vertex
fn VSMain(input: VertexInput) -> @builtin(position) vec4<f32> {
    // 直接使用网格的模型矩阵
    let worldPos = GetModelMatrix() * vec4<f32>(input.position, 1.0);
    let viewPos = scene.viewMatrix * worldPos;
    return scene.projMatrix * viewPos;
}

@fragment
fn FSMain() {
    // Early-Z pass 不需要输出颜色
} 