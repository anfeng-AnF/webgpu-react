#include "../Common/SceneCommon.wgsh"
#include "../Common/LightCommon.wgsh"
#include "../Common/Common.wgsh"

// 在 group(1) 中绑定各个输入与输出纹理
@group(1) @binding(0)
var gBufferA: texture_2d<f32>; // 存储世界空间法线（经过编码）

@group(1) @binding(1)
var gBufferB: texture_2d<f32>; // 材质参数（例如 Specular,Roughness,Metallic）

@group(1) @binding(2)
var gBufferC: texture_2d<f32>; // 存储 BaseColor

@group(1) @binding(3)
var gBufferD: texture_2d<f32>; // 预留附加信息

@group(1) @binding(4)
var sceneDepth: texture_depth_2d; // 场景的深度纹理

@group(1) @binding(5)
var shadowMap: texture_depth_2d; // 阴影贴图

@group(1) @binding(6)
var outputTex: texture_storage_2d<rgba8unorm, write>; // 最终输出的存储纹理

// 采用 8x8 的 workgroup 尺寸
@compute @workgroup_size(8, 8, 1)
fn CSMain(@builtin(global_invocation_id) global_id: vec3<u32>) {
    //转为UV
    let dims: vec2<u32> = textureDimensions(outputTex);

    var u: f32 = f32(global_id.x) / f32(dims.x);
    var v: f32 = f32(global_id.y) / f32(dims.y);
    var time:f32 = scene.timeDelta.x;


    var time2: f32 = 3*time;

    u =sin(8.0*u*pi+time);

    v=sin(8.0*v*pi+time);

    u+=v;

    v=0.0;
    textureStore(outputTex, vec2<i32>(global_id.xy), vec4<f32>(abs(saturate(u)), abs(fract(v)), 0.0, 1.0));
}

