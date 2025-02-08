struct VSOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) texCoord: vec2<f32>
}

@vertex
fn VSMain(@builtin(vertex_index) VertexIndex : u32) -> VSOutput {
    var pos = array<vec2<f32>, 4>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>( 1.0, -1.0),
        vec2<f32>(-1.0,  1.0),
        vec2<f32>( 1.0,  1.0)
    );
    var texCoord = array<vec2<f32>, 4>(
        vec2<f32>(0.0, 1.0),
        vec2<f32>(1.0, 1.0),
        vec2<f32>(0.0, 0.0),
        vec2<f32>(1.0, 0.0)
    );
    
    var output: VSOutput;
    output.position = vec4<f32>(pos[VertexIndex], 0.0, 1.0);
    output.texCoord = texCoord[VertexIndex];
    return output;
}

@group(0) @binding(0) var texSampler: sampler;
@group(0) @binding(1) var colorTexture: texture_2d<f32>;

@fragment
fn FSColorMain(@location(0) texCoord: vec2<f32>) -> @location(0) vec4<f32> {
    return textureSample(colorTexture, texSampler, texCoord);
}

@fragment
fn FSRGB10A2Main(@location(0) texCoord: vec2<f32>) -> @location(0) vec4<f32> {
    let color = textureSample(colorTexture, texSampler, texCoord);
    // RGB10A2 格式的颜色值需要特殊处理
    // 将 10 位颜色值转换为 8 位
    return vec4<f32>(
        color.rgb , // 将 10 位值缩放到 8 位范围
        color.a                        // alpha 保持不变
    );
} 