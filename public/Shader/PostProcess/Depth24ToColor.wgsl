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
@group(0) @binding(0) var depthSampler: sampler;
@group(0) @binding(1) var depthTexture: texture_depth_2d;
@fragment
fn FSDepthMain(@location(0) texCoord: vec2<f32>) -> @location(0) vec4<f32> {
    let depth = textureSample(depthTexture, depthSampler, texCoord);
    
    // 调整深度值的可视化
    // 将 [0,1] 范围的深度值映射到更容易看到的范围
    let adjustedDepth = 1.0 - pow(depth, 32.0);
    
    return vec4<f32>(adjustedDepth, adjustedDepth, adjustedDepth, 1.0);
}