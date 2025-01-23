#include "SceneData.wgsh"

// 骨骼数据
struct BoneMatrices {
    matrices: array<mat4x4<f32>>
};

// 绑定组
@group(1) @binding(0) var<storage> boneMatrices: BoneMatrices;

// 顶点着色器输出
struct VertexOutput {
    @builtin(position) position: vec4<f32>
};

// 静态网格顶点着色器
@vertex
fn vsStaticMesh(
    @location(0) position: vec3<f32>
) -> VertexOutput {
    var output: VertexOutput;
    output.position = GetClipPosition(position);
    return output;
}

// 骨骼网格顶点着色器
@vertex
fn vsSkeletalMesh(
    @location(0) position: vec3<f32>,
    @location(7) boneIndices: vec4<u32>,
    @location(8) boneWeights: vec4<f32>
) -> VertexOutput {
    var output: VertexOutput;
    
    // 计算骨骼变换后的位置
    var skinnedPosition = vec3(0.0);
    
    // 应用每个骨骼的变换
    for (var i = 0u; i < 4u; i++) {
        let weight = boneWeights[i];
        if (weight > 0.0) {  // 只处理有权重的骨骼
            let boneIndex = boneIndices[i];
            let boneMatrix = boneMatrices.matrices[boneIndex];
            let transformedPos = (boneMatrix * vec4(position, 1.0)).xyz;
            skinnedPosition += transformedPos * weight;
        }
    }

    // 如果顶点不受任何骨骼影响（所有权重为0），使用原始位置
    if (skinnedPosition.x == 0.0 && skinnedPosition.y == 0.0 && skinnedPosition.z == 0.0) {
        skinnedPosition = position;
    }

    output.position = GetClipPosition(skinnedPosition);
    return output;
}

// 实例化网格顶点着色器
@vertex
fn vsInstancedMesh(
    @location(0) position: vec3<f32>,
    @builtin(instance_index) instanceIndex: u32
) -> VertexOutput {
    var output: VertexOutput;
    output.position = GetClipPosition(position);
    return output;
}

// 片段着色器（所有类型共用）
@fragment
fn fsMain() -> @location(0) vec4<f32> {
    // Early-Z Pass 不需要输出颜色
    return vec4(0.0);
} 