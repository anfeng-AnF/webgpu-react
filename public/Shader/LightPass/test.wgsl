#include "../Common/SceneCommon.wgsh"
#include "../Common/LightCommon.wgsh"
#include "../Common/Common.wgsh"

// 在 group(1) 中绑定各个输入与输出纹理
@group(1) @binding(0)
var gBufferA: texture_2d<f32>; // RGB10A2UNORM - worldNormal

@group(1) @binding(1)
var gBufferB: texture_2d<f32>; // RGBA8UNORM - Specular,Roughness,Metallic

@group(1) @binding(2)
var gBufferC: texture_2d<f32>; // RGBA8UNORM - BaseColor

@group(1) @binding(3)
var gBufferD: texture_2d<f32>; // RGBA8UNORM - Additional

@group(1) @binding(4)
var sceneDepth: texture_depth_2d; // 场景的深度纹理

@group(1) @binding(5)
var shadowMap: texture_depth_2d_array; // 阴影贴图

@group(1) @binding(6)
var outputTex: texture_storage_2d<rgba8unorm, write>; // 最终输出的存储纹理

@group(1) @binding(7)
var shadowMapSampler: sampler;


// 采用 8x8 的 workgroup 尺寸
@compute @workgroup_size(8, 8, 1)
fn CSMain(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let coord = vec2<i32>(global_id.xy);
    
    // 重建世界坐标
    let depth = textureLoad(sceneDepth, coord, 0);
    let texSize = textureDimensions(sceneDepth);
    let uv = (vec2<f32>(coord) + 0.5) / vec2<f32>(texSize);
    let worldPos = ReconstructWorldPositionFromDepth(depth, uv);
    
    //测试世界位置
    //textureStore(outputTex, coord, vec4<f32>(saturate(worldPos.x),saturate(worldPos.y),saturate(worldPos.z),saturate(worldPos.x)));
    //return;

    // 远距离物体直接返回BaseColor
    if length(worldPos) > 1e4 {
        textureStore(outputTex, coord, textureLoad(gBufferC, coord, 0));
        return;
    }
    
    // 读取G-Buffer数据
    let normalData = textureLoad(gBufferA, coord, 0);
    let materialData = textureLoad(gBufferB, coord, 0);
    let baseColor = textureLoad(gBufferC, coord, 0).rgb;
    
    // 解码材质参数
    let worldNormal = normalize(normalData.xyz * 2.0 - 1.0);
    let specular = materialData.x;
    let roughness = materialData.y;
    let metallic = materialData.z;
    
    // 阴影计算
    var shadow: f32 = 1.0;
    let lightViewPos = DirectionalLight.viewMatrix * vec4(worldPos, 1.0);
    let lightClipPos = DirectionalLight.projectionMatrix * lightViewPos;
    let lightNDC = lightClipPos / lightClipPos.w * 0.5 + 0.5;
    let shadowUV = vec2<f32>(lightNDC.x,1-lightNDC.y);

    if (lightNDC.z < 0.0 || lightNDC.z > 1.0) {
        // 光源的Z值不在有效的裁剪空间内
        textureStore(outputTex, coord, textureLoad(gBufferC, coord, 0));
        return;
    }

    // 检查 shadowUV 是否在有效的范围内 (0,0) 到 (1,1)
    if (shadowUV.x < 0.0 || shadowUV.x > 1.0 || shadowUV.y < 0.0 || shadowUV.y > 1.0) {
        // 如果 UV 越界，直接返回基础颜色
        textureStore(outputTex, coord, textureLoad(gBufferC, coord, 0));
        return;
    }


    if all(shadowUV >= vec2(0.0)) && all(shadowUV <= vec2(1.0)) {
        // 计算阴影偏移
        let lightDir = normalize(DirectionalLight.lightDirection.xyz);
        let normalBias = (1.0 - max(dot(worldNormal, lightDir), 0.0)) * 0.0001;
        let currentDepth = lightNDC.z - DirectionalLight.lightBias - normalBias;
        
        // 转换阴影贴图坐标
        let shadowSize = textureDimensions(shadowMap);
        let texelSize = 1.0 / vec2<f32>(shadowSize);
        
        // PCF
        const numSample = 7u;
        const halfSample = (numSample - 1u) / 2u;
        var shadowSum: f32 = 0.0;
        var validSamples: f32 = 0.0;
        
        // 计算有效采样范围
        let minUV = vec2<f32>(texelSize) * f32(halfSample);
        let maxUV = vec2<f32>(1.0) - minUV;
        
        // 只在有效范围内进行采样
        if all(shadowUV >= minUV) && all(shadowUV <= maxUV) {
            for(var i: u32 = 0u; i < numSample; i++) {
                for(var j: u32 = 0u; j < numSample; j++) {
                    // 计算采样偏移
                    let offset = vec2<f32>(
                        f32(i) - f32(halfSample),
                        f32(j) - f32(halfSample)
                    ) * texelSize;
                    
                    // 采样阴影贴图
                    let sampleUV = shadowUV + offset;
                    let sampleCoord = vec2<i32>(sampleUV * vec2<f32>(shadowSize));
                    let shadowDepth = textureLoad(shadowMap, sampleCoord, 0, 0);
                    shadowSum += f32(currentDepth <= shadowDepth);
                    validSamples += 1.0;
                }
            }
            
            // 计算平均阴影值
            shadow = shadowSum / validSamples;
        }
        
        //textureStore(outputTex, coord, vec4<f32>(shadow, shadow, shadow, 1.0));
        //return;
    }
    
    // PBR光照计算
    let N = worldNormal;
    let V = normalize(scene.camPosFar.xyz - worldPos);
    let L = normalize(-DirectionalLight.lightDirection.xyz);
    let H = normalize(V + L);
    
    let NdotL = max(dot(N, L), 0.0);
    let NdotV = max(dot(N, V), 0.0);
    let NdotH = max(dot(N, H), 0.0);
    let HdotV = max(dot(H, V), 0.0);
    
    // 漫反射项
    let diffuse = baseColor * DirectionalLight.lightColor.rgb * NdotL / pi;
    
    // 镜面反射项 (简化Cook-Torrance)
    let F0 = mix(vec3(0.04), baseColor, metallic);
    let F = F0 + (1.0 - F0) * pow(1.0 - HdotV, 5.0);
    let kD = (1.0 - F) * (1.0 - metallic);
    let D = roughness * roughness / (pi * pow(NdotH * NdotH * (roughness - 1.0) + 1.0, 2.0));
    let G = min(1.0, min(2.0 * NdotH * NdotV / HdotV, 2.0 * NdotH * NdotL / HdotV));
    let specularTerm = (D * F * G) / (4.0 * NdotL * NdotV + 0.001);
    
    // 添加环境光
    let ambientStrength = 0.4;  // 环境光强度
    let ambient = ambientStrength * baseColor;
    
    // 组合结果（加入环境光）
    let finalColor = ambient + (diffuse + specularTerm) * DirectionalLight.lightIntensity * shadow;
    textureStore(outputTex, coord, vec4(finalColor, 1.0));
}

