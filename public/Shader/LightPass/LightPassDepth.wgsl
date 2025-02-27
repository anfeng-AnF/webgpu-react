#include "../Common/SceneCommon.wgsh"
#include "../Common/LightCommon.wgsh"
#include "../Common/Common.wgsh"



@vertex
fn VSMain(
    input: StaticMeshVertexInput
) -> @builtin(position) vec4<f32> {
    let worldPos = GetModelMatrix() * vec4<f32>(input.position, 1.0);
    let viewPos = DirectionalLight.viewMatrix * worldPos;
    let clipPos = DirectionalLight.projectionMatrix * viewPos;
    let ndcPos = clipPos / clipPos.w;
    let outPos = vec4<f32>(ndcPos.x, ndcPos.y, ndcPos.z*0.5+0.5, 1.0);
    return outPos;
}

@fragment
fn PSMain() {
    // shadow map 不需要输出颜色
}