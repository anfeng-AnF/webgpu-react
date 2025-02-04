#include "../Common/SceneBuffer.wgsh"

struct ModelBuffer {
    modelMatrix: mat4x4<f32>
}

@group(1) @binding(0) var<uniform> model: ModelBuffer;

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
    // 先应用模型变换，再应用视图和投影变换
    let worldPos = model.modelMatrix * vec4<f32>(input.position, 1.0);
    let viewPos = scene.viewMatrix * worldPos;
    return scene.projMatrix * viewPos;
}

@fragment
fn FSMain() {
    // Early-Z pass 不需要输出颜色
} 