#include "../Common/MeshInfo.wgsh"
#include "../Common/SceneBuffer.wgsh"

@group(2) @binding(0) var texture_baseColor: texture_2d<f32>;
@group(2) @binding(1) var texture_normal: texture_2d<f32>;
@group(2) @binding(2) var texture_metallic: texture_2d<f32>;
@group(2) @binding(3) var texture_specular: texture_2d<f32>;
@group(2) @binding(4) var texture_roughness: texture_2d<f32>;

@group(2) @binding(5) var sampler_baseColor: sampler;
@group(2) @binding(6) var sampler_normal: sampler;
@group(2) @binding(7) var sampler_metallic: sampler;
@group(2) @binding(8) var sampler_specular: sampler;
@group(2) @binding(9) var sampler_roughness: sampler;


struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) tangent: vec3<f32>,
    @location(3) uv0: vec2<f32>,
    @location(4) uv1: vec2<f32>,
    @location(5) uv2: vec2<f32>,
    @location(6) uv3: vec2<f32>,
}

struct vsOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) normal: vec3<f32>,
    @location(1) tangent: vec3<f32>,
    @location(2) uv0: vec2<f32>,
    @location(3) uv1: vec2<f32>,
    @location(4) uv2: vec2<f32>,
    @location(5) uv3: vec2<f32>,
}

@vertex
fn VSMain(input: VertexInput) -> vsOutput {
    let worldPos = GetModelMatrix() * vec4<f32>(input.position, 1.0);
    let viewPos = scene.viewMatrix * worldPos;
    var clipPos = scene.projMatrix * viewPos;
    
    // 在投影空间应用像素深度偏移
    let PBRParam = GetPBRMaterialInfo();
    if (PBRParam.flags != 0u && PBRParam.PixelDepthOffset != 0.0) {
        clipPos.z += PBRParam.PixelDepthOffset * clipPos.w;
    }
    
    return vsOutput(
        clipPos,
        input.normal, 
        input.tangent, 
        input.uv0, 
        input.uv1, 
        input.uv2, 
        input.uv3
    );
}


struct FragmentOutput {
    @location(0) GBufferA: vec4<f32>,//RGB10A2UNORM
    @location(1) GBufferB: vec4<f32>,//RGBA8UNORM
    @location(2) GBufferC: vec4<f32>,//RGBA8UNORM
    @location(3) GBufferD: vec4<f32>,//RGBA8UNORM
    @location(4) GBufferE: vec4<f32>,//RGBA8UNORM
}

@fragment
fn PSMain(input: vsOutput) -> FragmentOutput {
    let PBRParam = GetPBRMaterialInfo();
    
    // 如果材质参数错误，输出醒目的紫红色
    if (PBRParam.flags == 0u) {  // 使用标志位为0来表示无效材质
        return FragmentOutput(
            vec4<f32>(0.0, 0.0, 1.0, 1.0),     // GBufferA: normal
            vec4<f32>(0.0, 0.0, 0.0, 1.0),     // GBufferB: Specular,Roughness,Metallic
            vec4<f32>(1.0, 0.0, 1.0, 1.0),     // GBufferC: BaseColor (紫红色)
            vec4<f32>(0.0, 0.0, 0.0, 1.0),     // GBufferD: Additional
            vec4<f32>(0.0, 0.0, 0.0, 1.0)      // GBufferE: Additional
        );
    }
    
    // 计算基础颜色
    var baseColor = PBRParam.BaseColor;
    if ((PBRParam.flags & BASE_COLOR_USE_TEXTURE) != 0u) {
        baseColor = textureSample(texture_baseColor, sampler_baseColor, input.uv0);
    }
    
    // 计算金属度
    var metallic = PBRParam.Metallic;
    if ((PBRParam.flags & METALLIC_USE_TEXTURE) != 0u) {
        metallic = textureSample(texture_metallic, sampler_metallic, input.uv0).r;
    }
    
    // 计算高光
    var specular = PBRParam.Specular;
    if ((PBRParam.flags & SPECULAR_USE_TEXTURE) != 0u) {
        specular = textureSample(texture_specular, sampler_specular, input.uv0).r;
    }
    
    // 计算粗糙度
    var roughness = PBRParam.Roughness;
    if ((PBRParam.flags & ROUGHNESS_USE_TEXTURE) != 0u) {
        roughness = textureSample(texture_roughness, sampler_roughness, input.uv0).r;
    }
    
    // 计算世界空间法线
    let normalMatrix = mat3x3<f32>(
        PBRParam.modelMatrix[0].xyz,
        PBRParam.modelMatrix[1].xyz,
        PBRParam.modelMatrix[2].xyz
    );
    let worldNormal = normalize(input.normal * normalMatrix);
    
    // 输出到GBuffer
    return FragmentOutput(
        vec4<f32>(worldNormal * 0.5 + 0.5, 1.0),                 // GBufferA: normal (转换到[0,1]范围)
        vec4<f32>(specular, roughness, metallic, 1.0),           // GBufferB: Specular,Roughness,Metallic
        vec4<f32>(baseColor.rgb, baseColor.a),                   // GBufferC: BaseColor
        vec4<f32>(0.0, 0.0, 0.0, 1.0),                          // GBufferD: 预留
        vec4<f32>(0.0, 0.0, 0.0, 1.0)                           // GBufferE: 预留
    );
}
