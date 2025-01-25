// 顶点着色器
@vertex
fn vsMain(@builtin(vertex_index) VertexIndex : u32) -> @builtin(position) vec4<f32> {
    // 生成全屏三角形的顶点
    var pos = array<vec2<f32>, 3>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>( 3.0, -1.0),
        vec2<f32>(-1.0,  3.0)
    );
    return vec4<f32>(pos[VertexIndex], 0.0, 1.0);
}

// 片段着色器
@group(0) @binding(0) var depthTexture: texture_depth_2d;

@fragment
fn fsMain(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
    let depth = textureLoad(depthTexture, vec2<i32>(pos.xy), 0);
    // 将深度值映射到灰度颜色
    return vec4<f32>(depth, depth, depth, 1.0);
}