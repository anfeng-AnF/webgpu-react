import { ResourceConfig, EarlyZPipelineDesc } from '../Renderer/InitResource/DeferredRendering/ResourceConfig.js';
/**
 * 静态网格顶点格式
 */
export const EStaticMeshVertex = {
    Position: 0,      // vec3<f32> - 位置
    Normal: 1,        // vec3<f32> - 法线
    Tangent: 2,      // vec3<f32> - 切线
    UV0: 3,          // vec2<f32> - 主UV
    UV1: 4,          // vec2<f32> - 第二UV
    UV2: 5,          // vec2<f32> - 第三UV
    UV3: 6,          // vec2<f32> - 第四UV
};

/**
 * 骨骼网格顶点格式（继承静态网格格式）
 */
export const ESkeletalMeshVertex = {
    ...EStaticMeshVertex,
    BoneIndices: 7,   // vec4<u32> - 骨骼索引
    BoneWeights: 8,   // vec4<f32> - 骨骼权重
};

/**
 * 绑定组布局
 */
export const EMeshBindingLayout = {
    Scene: 0,        // 场景数据（相机等）
    Meshes: 1,       // 所有Mesh的变换矩阵 (storage buffer)
    Index: 2,        // 当前Mesh的索引 (uniform buffer with dynamic offset)
};

/**
 * 网格顶点工厂
 */
class FMeshVertexFactory {
    
    /**
     * 创建静态网格顶点数据
     * @param {Float32Array} positions 位置数组 [x,y,z, x,y,z, ...]
     * @param {Float32Array} normals 法线数组
     * @param {Float32Array} tangents 切线数组
     * @param {Float32Array} uvs UV数组 [u0,v0,u1,v1,u2,v2,u3,v3, ...]
     * @returns {Float32Array} 打包后的顶点数据
    */
   static CreateStaticMeshVertices(positions, normals, tangents, uvs) {
       const vertexCount = positions.length / 3;
       const vertices = new Float32Array(vertexCount * 14); // 14 = (3+3+3+2+2+2+2) floats per vertex
       
       for (let i = 0; i < vertexCount; i++) {
           const vertexOffset = i * 14;
            const posOffset = i * 3;
            const uvOffset = i * 8;

            // 位置
            vertices[vertexOffset] = positions[posOffset];
            vertices[vertexOffset + 1] = positions[posOffset + 1];
            vertices[vertexOffset + 2] = positions[posOffset + 2];
            
            // 法线
            vertices[vertexOffset + 3] = normals[posOffset];
            vertices[vertexOffset + 4] = normals[posOffset + 1];
            vertices[vertexOffset + 5] = normals[posOffset + 2];

            // 切线
            vertices[vertexOffset + 6] = tangents[posOffset];
            vertices[vertexOffset + 7] = tangents[posOffset + 1];
            vertices[vertexOffset + 8] = tangents[posOffset + 2];
            
            // UVs
            for (let j = 0; j < 4; j++) {
                vertices[vertexOffset + 9 + j * 2] = uvs[uvOffset + j * 2];
                vertices[vertexOffset + 10 + j * 2] = uvs[uvOffset + j * 2 + 1];
            }
        }
        
        return vertices;
    }
    
    /**
     * 创建骨骼数据
     * @param {Uint8Array} boneIndices 骨骼索引数组 [i0,i1,i2,i3, ...]
     * @param {Uint8Array} boneWeights 骨骼权重数组 [w0,w1,w2,w3, ...]
     * @returns {Uint8Array} 打包后的骨骼数据
    */
   static CreateSkeletalData(boneIndices, boneWeights) {
       return new Uint8Array([...boneIndices, ...boneWeights]);
    }


    
    /**
     * 获取静态网格顶点布局
     * @returns {GPUVertexBufferLayout}
     */
    static GetStaticMeshLayout() {
        return ResourceConfig.GetStaticMeshLayout();
    }
 
    /**
     * 获取骨骼网格顶点布局
     * @returns {Array<GPUVertexBufferLayout>}
     */
    static GetSkeletalMeshLayout() {
        return ResourceConfig.GetSkeletalMeshLayout();
    }

    
    /**
     * 获取场景数据绑定组布局
    */
   static GetSceneBindGroupLayout() {
       return ResourceConfig.GetBindGroupLayout('Scene');
    }

    /**
     * 获取网格变换数据绑定组布局
     */
    static GetMeshTransformBindGroupLayout() {
        return ResourceConfig.GetBindGroupLayout('MeshTransform');
    }

    /**
     * 获取网格索引绑定组布局
     */
    static GetMeshIndexBindGroupLayout() {
        return ResourceConfig.GetBindGroupLayout('MeshIndex');
    }

    /**
     * 获取骨骼数据绑定组布局
     */
    static GetBoneBindGroupLayout() {
        return ResourceConfig.GetBindGroupLayout('Bone');
    }
}

export default FMeshVertexFactory; 