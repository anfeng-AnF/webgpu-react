#include "../Common/SceneCommon.wgsh"
#include "../Common/DirectionalLightCommon.wgsh"
#include "../Common/Common.wgsh"

// 在 group(1) 中绑定各个输入与输出纹理
@group(2) @binding(0)
var gBufferA: texture_2d<f32>; // RGB10A2UNORM - worldNormal

@group(2) @binding(1)
var gBufferB: texture_2d<f32>; // RGBA8UNORM - Specular,Roughness,Metallic

@group(2) @binding(2)
var gBufferC: texture_2d<f32>; // RGBA8UNORM - BaseColor

@group(2) @binding(3)
var gBufferD: texture_2d<f32>; // RGBA8UNORM - Additional

@group(2) @binding(4)
var sceneDepth: texture_depth_2d; // 场景的深度纹理

@group(2) @binding(5)
var shadowMap: texture_depth_2d_array; // 阴影贴图

@group(2) @binding(6)
var outputTex: texture_storage_2d<rgba8unorm, write>; // 最终输出的存储纹理


// 采用 8x8 的 workgroup 尺寸
@compute @workgroup_size(8, 8, 1)
fn CSMain(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let coord = vec2<i32>(global_id.xy);
    let depth = textureLoad(sceneDepth, coord, 0);
    let uv = vec2<f32>(coord) / vec2<f32>(textureDimensions(sceneDepth));
    let worldPos = ReconstructWorldPositionFromDepth(depth, uv);
    let viewPos = scene.viewMatrix * vec4<f32>(worldPos, 1.0);



    let dimension = textureDimensions(shadowMap);

    // 数组定义8个颜色
    let colors = array<vec4<f32>, 8>(
        vec4<f32>(1.0, 0.0, 0.0, 1.0),
        vec4<f32>(0.0, 1.0, 0.0, 1.0),
        vec4<f32>(0.0, 0.0, 1.0, 1.0),
        vec4<f32>(1.0, 1.0, 0.0, 1.0),
        vec4<f32>(0.0, 1.0, 1.0, 1.0),
        vec4<f32>(1.0, 0.0, 1.0, 1.0),
        vec4<f32>(1.0, 1.0, 1.0, 1.0),
        vec4<f32>(0.0, 0.0, 0.0, 1.0),
    );

    for(var i = 0u; i < u32(DirectionalLight.numCascades); i++) {
        if(DirectionalLightCascade[i].cascadeDepth.x < -viewPos.z) {
            textureStore(outputTex, coord, colors[i]); 
        }
    }
}

