#include "../Common/SceneCommon.wgsh"
#include "../Common/LightCommon.wgsh"
#include "../Common/Common.wgsh"



@vertex
fn VSMain(
    input: StaticMeshVertexInput
) -> @builtin(position) vec4<f32> {
    let worldPos = GetModelMatrix() * vec4<f32>(input.position, 1.0);
    let viewPos = DirectionalLight.viewMatrix * worldPos;
    return DirectionalLight.projectionMatrix * viewPos;
}

@fragment
fn PSMain() {
    // shadow map 不需要输出颜色
}