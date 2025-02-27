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

@group(2) @binding(7)
var envMap: texture_2d<f32>; // 环境贴图

@group(2) @binding(8)
var envMapSampler: sampler; // 环境贴图采样器

// 采用 8x8 的 workgroup 尺寸
@compute @workgroup_size(8, 8, 1)
fn CSMain(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let coord = vec2<i32>(global_id.xy);

    let depth = textureLoad(sceneDepth, coord, 0);
    let normal = textureLoad(gBufferA, coord, 0)*2.0-1.0;
    let SRM = textureLoad(gBufferB, coord, 0);
    let BaseColor = textureLoad(gBufferC, coord, 0);
    let Additional = textureLoad(gBufferD, coord, 0);

    
    let uv = vec2<f32>(coord) / vec2<f32>(textureDimensions(sceneDepth));
    let worldPos = ReconstructWorldPositionFromDepth(depth, uv);

    // 不对远处进行阴影计算
    if(length(worldPos) > 1000.0) {
        textureStore(outputTex, coord, BaseColor);
        return;
    }

    //let viewPos = scene.viewMatrix * vec4<f32>(worldPos, 1.0);

    //textureStore(outputTex, coord, vec4<f32>(viewPos.xyz, 1.0));
    //return;

    let dimension = vec2<i32>(textureDimensions(shadowMap).xy);

    // 数组定义8个颜色
    let colors = array<vec4<f32>, 8>(
        vec4<f32>(0.0, 0.0, 1.0, 1.0),
        vec4<f32>(0.0, 1.0, 0.0, 1.0),
        vec4<f32>(0.0, 1.0, 1.0, 1.0),
        vec4<f32>(1.0, 0.0, 0.0, 1.0),
        vec4<f32>(1.0, 0.0, 1.0, 1.0),
        vec4<f32>(1.0, 1.0, 0.0, 1.0),
        vec4<f32>(1.0, 1.0, 1.0, 1.0),
        vec4<f32>(0.0, 0.0, 0.0, 1.0),
    );

    //textureStore(outputTex, coord, vec4<f32>(f32(viewPos.z>-25000.0), 0.0, 0.0, 1.0));
    //return;
    //textureStore(outputTex, coord, vec4<f32>(-DirectionalLightCascade[3].cascadeDepth.x/2.0/13.712408,0.0,0.0, 1.0));
    //return;

    var cascadeLevel = 0u;
    for(var i = 0u; i < u32(DirectionalLight.numCascades); i++) {
        //尝试球体判别
        let distance = length(worldPos - DirectionalLightCascade[i].sphereCenterRadius.xyz);
        if(distance <= DirectionalLightCascade[i].sphereCenterRadius.w) {
            // 返回满足条件的最低级联
            //textureStore(outputTex, coord, colors[i]); 
            cascadeLevel = i;
            break;
        }
    }

    // 世界坐标->光源视角坐标
    let lightClipPos = 
    DirectionalLightCascade[cascadeLevel].projectionMatrix * 
    DirectionalLightCascade[cascadeLevel].viewMatrix * 
    vec4<f32>(worldPos, 1.0);
    let lightNDCPos = lightClipPos * 0.5 + 0.5;
    let lightUV = vec2<i32>(vec2<f32>(lightNDCPos.x,1 - lightNDCPos.y)*vec2<f32>(textureDimensions(shadowMap).xy));
    
    if((lightNDCPos.z < 0.0)||(lightNDCPos.z > 1.0)||(lightUV.x < 0) || (lightUV.x >= dimension.x) || (lightUV.y < 0) || (lightUV.y >= dimension.y)) {
        textureStore(outputTex, coord, vec4<f32>(0.5, 0.5, 0.0, 1.0));
        return;
    }
    var NoL = dot(normal.xyz,DirectionalLight.lightDirection.xyz);
    let normalBias = DirectionalLightCascade[cascadeLevel].lightBiasNormalBias.y*NoL;
    let currentDepth = lightNDCPos.z + normalBias + DirectionalLightCascade[cascadeLevel].lightBiasNormalBias.x;
    let lightDepth = textureLoad(shadowMap,lightUV,cascadeLevel,0);

    // 显示cascade深度
    if(DirectionalLight.bShowCascade!=0.0) {
        textureStore(outputTex, coord, vec4<f32>(pow(lightDepth,2)*colors[cascadeLevel]));
        return;
    }



    if(currentDepth > lightDepth) {
        textureStore(outputTex, coord, vec4<f32>(0.0, 0.0, 0.0, 1.0));
    } else {
        textureStore(outputTex, coord, vec4<f32>(1.0, 1.0, 1.0, 1.0));
    }

    // pcf
    var shadow = 0.0;
    let texelSize = 1.0 / f32(textureDimensions(shadowMap).x);
    let kernelSize = 1; // 控制kernel大小，1表示3x3, 2表示5x5, 以此类推
    let totalSamples = f32((kernelSize * 2 + 1) * (kernelSize * 2 + 1));
    
    // NxN PCF kernel
    for(var x = -kernelSize; x <= kernelSize; x++) {
        for(var y = -kernelSize; y <= kernelSize; y++) {
            let offset = vec2<i32>(x, y);
            let sampleUV = lightUV + offset;
            
            // Ensure we don't sample outside the shadow map
            if(sampleUV.x >= 0 && sampleUV.x < dimension.x && 
               sampleUV.y >= 0 && sampleUV.y < dimension.y) {
                let sampleDepth = textureLoad(shadowMap, sampleUV, cascadeLevel, 0);
                
                if(currentDepth <= sampleDepth) {
                    shadow += 1.0;
                }
            }
        }
    }
    
    // Average the samples
    shadow /= totalSamples;

    // Output the final color with PCF shadow
    let shadowColor = mix(vec4<f32>(0.0), vec4<f32>(1.0), shadow);
    //textureStore(outputTex, coord, shadowColor);

    // 实现光照计算 cook-torrance方法
    let V = normalize(scene.camPosFar.xyz - worldPos); // 视线方向
    let L = normalize(-DirectionalLight.lightDirection.xyz); // 光线方向
    let N = normalize(normal.xyz); // 法线方向
    let H = normalize(L + V); // 半程向量
    
    // 获取材质属性
    let roughness = SRM.g;
    let metallic = SRM.b;
    let baseColor = BaseColor.rgb;
    
    // 计算基础项
    let NoV = max(dot(N, V), 0.0001);
    NoL = max(dot(N, L), 0.0);
    let NoH = max(dot(N, H), 0.0);
    let VoH = max(dot(V, H), 0.0);
    
    // 计算F0（0度反射率）
    let dielectricF0 = vec3<f32>(0.04); // 非金属的F0通常是0.04
    let F0 = mix(dielectricF0, baseColor, metallic);
    
    // Distribution - GGX/Trowbridge-Reitz
    let alpha = roughness * roughness;
    let alpha2 = alpha * alpha;
    let NoH2 = NoH * NoH;
    let D = alpha2 / (pi * pow(NoH2 * (alpha2 - 1.0) + 1.0, 2.0));
    
    // Fresnel - Schlick
    let F = F0 + (vec3<f32>(1.0) - F0) * pow(1.0 - VoH, 5.0);
    
    // Geometry - Smith with Schlick-GGX
    let k = (roughness + 1.0) * (roughness + 1.0) / 8.0;
    let GV = NoV / (NoV * (1.0 - k) + k);
    let GL = NoL / (NoL * (1.0 - k) + k);
    let G = GV * GL;
    
    // Specular BRDF
    let specular = (D * F * G) / (4.0 * NoV * NoL);
    
    // Diffuse BRDF (Lambert)
    let kD = (vec3<f32>(1.0) - F) * (1.0 - metallic);
    let diffuse = kD * baseColor / pi;
    
    // 合并直接光照
    let directLight = (diffuse + specular) * DirectionalLight.lightColor.rgb * DirectionalLight.lightIntensity * NoL;

    // 计算环境贴图采样方向
    let R = reflect(-V, N); // 反射向量
    let envReflection = SampleEnvironmentMap(R, roughness);

    // 计算菲涅尔项用于环境反射
    let envFresnel = F0 + (1.0 - F0) * pow(1.0 - NoV, 5.0);

    let envStrength = 0.5;  // 降低环境光强度
    
    // 基于粗糙度计算环境贴图的影响
    let envInfluence = pow(1.0 - roughness, 2.0);
    
    // 降低基础环境光强度
    let baseEnvLight = vec3<f32>(0.1, 0.1, 0.1) * envStrength;
    
    // 根据金属度计算漫反射和镜面反射
    let envDiffuse = mix(baseEnvLight, envReflection, envInfluence) * (1.0 - metallic) * baseColor;
    let envSpecular = envReflection * envFresnel * envInfluence * envStrength* baseColor*1.5;  // 对镜面反射也应用强度系数

    // 降低环境遮蔽强度
    let ambientOcclusion = 0.1;
    let roughDiffuse = baseColor * (1.0 - envInfluence) * ambientOcclusion;

    // 混合最终的环境光照
    let envColor = envDiffuse + envSpecular + roughDiffuse;

    // 将直接光照和环境光照结合
    let finalColor = max(directLight * shadow, vec3<f32>(0.0)) + envColor;
    

    // 输出最终颜色（添加gamma校正）
    let gammaCorrected = pow(finalColor, vec3<f32>(1.0/2.2));
    textureStore(outputTex, coord, vec4<f32>(gammaCorrected, 1.0));
}

// 计算环境光HDR贴图采样
fn SampleEnvironmentMap(R: vec3<f32>, roughness: f32) -> vec3<f32> {
    // 计算球面坐标
    let envUV = vec2<f32>(
        atan2(R.z, R.x) / (2.0 * pi) + 0.5,
        acos(R.y) / pi
    );

    let mipLevel = i32(roughness * 8.0);
    // 将UV坐标转换为纹理坐标
    let texSize = vec2<f32>(textureDimensions(envMap));
    let texCoord = vec2<i32>(envUV * texSize)/i32(pow(2.0,f32(mipLevel)));


    return textureLoad(envMap, texCoord, mipLevel).rgb;
}
