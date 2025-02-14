#include "../Common/SceneCommon.wgsh"

/* PBR材质参数结构 */
struct PBRMaterialInfo {
    // 基础材质信息 (4 floats)
    materialDomain: f32,
    blendMode: f32,
    shaderModel: f32,
    clipMode: f32,
    // 动态属性
    BaseColor: vec4<f32>,
    Normal: vec3<f32>,
    Metallic: f32,
    Roughness: f32,
    Specular: f32,
    PixelDepthOffset: f32,
    flags: u32,
}

/* 获取PBR材质信息 */
fn GetPBRMaterialInfo() -> PBRMaterialInfo {
    var info: PBRMaterialInfo;
    
    // 读取基础材质信息 (前4个float)
    info.materialDomain = meshInfos[0].data[0];
    info.blendMode = meshInfos[0].data[1];
    info.shaderModel = meshInfos[0].data[2];
    info.clipMode = meshInfos[0].data[3];
    
    // 读取动态属性
    // BaseColor (4 floats)
    info.BaseColor = vec4<f32>(
        meshInfos[0].data[4],
        meshInfos[0].data[5],
        meshInfos[0].data[6],
        meshInfos[0].data[7]
    );
    
    // Normal (3 floats)
    info.Normal = vec3<f32>(
        meshInfos[0].data[8],
        meshInfos[0].data[9],
        meshInfos[0].data[10]
    );
    
    // 其他PBR参数
    info.Metallic = meshInfos[0].data[11];
    info.Roughness = meshInfos[0].data[12];
    info.Specular = meshInfos[0].data[13];
    info.PixelDepthOffset = meshInfos[0].data[14];
    
    // 材质标志位
    info.flags = u32(meshInfos[0].data[15]);
    
    return info;
}

@group(1) @binding(0) var texture_baseColor: texture_2d<f32>;
@group(1) @binding(1) var texture_normal: texture_2d<f32>;
@group(1) @binding(2) var texture_metallic: texture_2d<f32>;
@group(1) @binding(3) var texture_specular: texture_2d<f32>;
@group(1) @binding(4) var texture_roughness: texture_2d<f32>;

@group(1) @binding(5) var sampler_baseColor: sampler;
@group(1) @binding(6) var sampler_normal: sampler;
@group(1) @binding(7) var sampler_metallic: sampler;
@group(1) @binding(8) var sampler_specular: sampler;
@group(1) @binding(9) var sampler_roughness: sampler;

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
    @location(0) GBufferA: vec4<f32>,  // RGB10A2UNORM - worldNormal
    @location(1) GBufferB: vec4<f32>,  // RGBA8UNORM - Specular,Roughness,Metallic
    @location(2) GBufferC: vec4<f32>,  // RGBA8UNORM - BaseColor
    @location(3) GBufferD: vec4<f32>,  // RGBA8UNORM - Additional
}

@fragment
fn PSMain(input: vsOutput) -> FragmentOutput {
    // 取反UV的Y轴
    var uv: vec2<f32> = input.uv0;
    uv.y = 1.0 - uv.y;

    
    let PBRParam = GetPBRMaterialInfo();
    
    // 计算切线空间到世界空间的转换矩阵
    let normalMatrix = mat3x3<f32>(
        GetModelMatrix()[0].xyz,
        GetModelMatrix()[1].xyz,
        GetModelMatrix()[2].xyz
    );
    
    // 计算世界空间的基向量
    let worldNormal = normalize(input.normal * normalMatrix);
    let worldTangent = normalize(input.tangent * normalMatrix);
    let worldBitangent = normalize(cross(worldNormal, worldTangent));
    
    // 构建TBN矩阵（切线空间到世界空间的变换矩阵）
    let TBN = mat3x3<f32>(
        worldTangent,
        worldBitangent,
        worldNormal
    );
    
    // 获取法线贴图值并转换到[-1,1]范围
    var normalTS = PBRParam.Normal;
    if ((PBRParam.flags & NORMAL_USE_TEXTURE) != 0u) {
        let normalMap = textureSample(texture_normal, sampler_normal, uv).rgb;
        normalTS = normalMap * 2.0 - 1.0;
    }
    
    // 将切线空间的法线转换到世界空间
    var finalNormal = worldNormal;
    if ((PBRParam.flags & NORMAL_USE_TEXTURE) != 0u) {
        finalNormal =-1* normalize(TBN * normalTS);
    }
    
    // 计算基础颜色
    var baseColor = PBRParam.BaseColor;
    if ((PBRParam.flags & BASE_COLOR_USE_TEXTURE) != 0u) {
        baseColor = textureSample(texture_baseColor, sampler_baseColor, uv);
    }
    
    // 计算金属度
    var metallic = PBRParam.Metallic;
    if ((PBRParam.flags & METALLIC_USE_TEXTURE) != 0u) {
        metallic = textureSample(texture_metallic, sampler_metallic, uv).r;
    }
    
    // 计算高光
    var specular = PBRParam.Specular;
    if ((PBRParam.flags & SPECULAR_USE_TEXTURE) != 0u) {
        specular = textureSample(texture_specular, sampler_specular, uv).r;
    }
    
    // 计算粗糙度
    var roughness = PBRParam.Roughness;
    if ((PBRParam.flags & ROUGHNESS_USE_TEXTURE) != 0u) {
        roughness = textureSample(texture_roughness, sampler_roughness, uv).r;
    }

    return FragmentOutput(
        vec4<f32>(finalNormal * 0.5 + 0.5, 1.0),                // GBufferA: normal (转换到[0,1]范围)
        vec4<f32>(specular, roughness, metallic, 1.0),          // GBufferB: Specular,Roughness,Metallic
        vec4<f32>(baseColor.rgb, baseColor.a),                  // GBufferC: BaseColor
        vec4<f32>(0.0, 0.0, 0.0, 1.0),                         // GBufferD: 预留
    );
}
