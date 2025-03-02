#include "../Common/SceneCommon.wgsh"
#include "../Common/DirectionalLightCommon.wgsh"
#include "../Common/Common.wgsh"




@vertex
fn VSMain(
    input: StaticMeshVertexInput
) -> @builtin(position) vec4<f32> {
    let worldPos = GetModelMatrix() * vec4<f32>(input.position, 1.0);
    let viewPos = DirectionalLightCascade[0].viewMatrix * worldPos;
    let clipPos = DirectionalLightCascade[0].projectionMatrix * viewPos; // 正交投影不做透视除法
    let outPos = vec4<f32>(clipPos.x, clipPos.y, clipPos.z*0.5 + 0.5, 1.0);
    return outPos;
}

@fragment
fn PSMain() {
    // shadow map 不需要输出颜色
}