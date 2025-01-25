import { FMesh } from './FMesh.js';
import { EMeshType } from './EMeshType.js';
import FResourceManager, { EResourceType } from '../Core/Resource/FResourceManager.js';
import { ResourceConfig } from '../Renderer/InitResource/DeferredRendering/ResourceConfig';

/**
 * Static mesh implementation
 */
class FStaticMesh extends FMesh {
    /**
     * @param {Float32Array} vertices - Vertex data array (60 bytes per vertex)
     * @param {Uint32Array} indices - Index data array
     */
    constructor(vertices, indices) {
        super();
        
        /** @type {Float32Array} */
        this.vertices = vertices;
        /** @type {Uint32Array} */
        this.indices = indices;
        
        this.vertexCount = vertices.byteLength / ResourceConfig.GetStaticMeshLayout().arrayStride;
        this.indexCount = indices.length;
        this.meshType = EMeshType.Static;

        // 创建GPU缓冲区
        this.CreateVertexBuffer();
        this.CreateIndexBuffer();
    }

    /**
     * @protected
     * @override
     */
    CreateVertexBuffer() {
        const bufferName = `VertexBuffer_${this.GetMeshID()}`;
        
        this.vertexBuffer = FResourceManager.GetInstance().CreateResource(
            bufferName,
            {
                Type: EResourceType.Buffer,
                desc: {
                    size: this.vertices.byteLength,
                    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
                    mappedAtCreation: true
                },
                Metadata: {
                    type: 'vertex',
                    vertexCount: this.vertices.length / 3,
                    createdAt: Date.now()
                }
            }
        );

        new Float32Array(this.vertexBuffer.getMappedRange()).set(this.vertices);
        this.vertexBuffer.unmap();
    }

    /**
     * @protected
     * @override
     */
    CreateIndexBuffer() {
        const bufferName = `IndexBuffer_${this.GetMeshID()}`;
        
        this.indexBuffer = FResourceManager.GetInstance().CreateResource(
            bufferName,
            {
                Type: EResourceType.Buffer,
                desc: {
                    size: this.indices.byteLength,
                    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
                    mappedAtCreation: true
                },
                Metadata: {
                    type: 'index',
                    indexCount: this.indices.length,
                    createdAt: Date.now()
                }
            }
        );

        new Uint32Array(this.indexBuffer.getMappedRange()).set(this.indices);
        this.indexBuffer.unmap();
    }

    /**
     * @override
     */
    Update() {
        super.Update();
        // 静态网格通常不需要每帧更新
        // 如果需要更新transform等数据，可以在这里实现
    }

    /**
     * @override
     */
    Destroy() {
        super.Destroy();
        this.vertices = null;
        this.indices = null;
    }

    /**
     * @override
     */
    GetMeshType() {
        return EMeshType.Static;
    }

    /**
     * 获取网格唯一ID
     * @private
     * @returns {string}
     */
    GetMeshID() {
        if (!this._meshID) {
            this._meshID = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
        return this._meshID;
    }

    /**
     * 创建立方体网格
     * @param {number} width - 宽度
     * @param {number} height - 高度
     * @param {number} depth - 深度
     * @returns {FStaticMesh} 立方体网格实例
     */
    static CreateCube(width = 1, height = 1, depth = 1) {
        const w = width * 0.5;
        const h = height * 0.5;
        const d = depth * 0.5;

        // 顶点数据：每个面4个顶点，6个面，每个顶点15个浮点数
        const vertices = new Float32Array([
            // Front face
            -w, -h,  d,   0, 0, 1,   1, 0, 0,   0, 0,   0, 0,   0, 0,   0, 0,  // 左下
             w, -h,  d,   0, 0, 1,   1, 0, 0,   1, 0,   1, 0,   1, 0,   1, 0,  // 右下
             w,  h,  d,   0, 0, 1,   1, 0, 0,   1, 1,   1, 1,   1, 1,   1, 1,  // 右上
            -w,  h,  d,   0, 0, 1,   1, 0, 0,   0, 1,   0, 1,   0, 1,   0, 1,  // 左上

            // Back face
            -w, -h, -d,   0, 0,-1,   -1, 0, 0,   1, 0,   1, 0,   1, 0,   1, 0,
             w, -h, -d,   0, 0,-1,   -1, 0, 0,   0, 0,   0, 0,   0, 0,   0, 0,
             w,  h, -d,   0, 0,-1,   -1, 0, 0,   0, 1,   0, 1,   0, 1,   0, 1,
            -w,  h, -d,   0, 0,-1,   -1, 0, 0,   1, 1,   1, 1,   1, 1,   1, 1,

            // Top face
            -w,  h, -d,   0, 1, 0,   1, 0, 0,   0, 0,   0, 0,   0, 0,   0, 0,
             w,  h, -d,   0, 1, 0,   1, 0, 0,   1, 0,   1, 0,   1, 0,   1, 0,
             w,  h,  d,   0, 1, 0,   1, 0, 0,   1, 1,   1, 1,   1, 1,   1, 1,
            -w,  h,  d,   0, 1, 0,   1, 0, 0,   0, 1,   0, 1,   0, 1,   0, 1,

            // Bottom face
            -w, -h, -d,   0,-1, 0,   1, 0, 0,   0, 1,   0, 1,   0, 1,   0, 1,
             w, -h, -d,   0,-1, 0,   1, 0, 0,   1, 1,   1, 1,   1, 1,   1, 1,
             w, -h,  d,   0,-1, 0,   1, 0, 0,   1, 0,   1, 0,   1, 0,   1, 0,
            -w, -h,  d,   0,-1, 0,   1, 0, 0,   0, 0,   0, 0,   0, 0,   0, 0,

            // Right face
             w, -h, -d,   1, 0, 0,   0, 0, 1,   0, 0,   0, 0,   0, 0,   0, 0,
             w,  h, -d,   1, 0, 0,   0, 0, 1,   0, 1,   0, 1,   0, 1,   0, 1,
             w,  h,  d,   1, 0, 0,   0, 0, 1,   1, 1,   1, 1,   1, 1,   1, 1,
             w, -h,  d,   1, 0, 0,   0, 0, 1,   1, 0,   1, 0,   1, 0,   1, 0,

            // Left face
            -w, -h, -d,   -1, 0, 0,   0, 0,-1,   1, 0,   1, 0,   1, 0,   1, 0,
            -w,  h, -d,   -1, 0, 0,   0, 0,-1,   1, 1,   1, 1,   1, 1,   1, 1,
            -w,  h,  d,   -1, 0, 0,   0, 0,-1,   0, 1,   0, 1,   0, 1,   0, 1,
            -w, -h,  d,   -1, 0, 0,   0, 0,-1,   0, 0,   0, 0,   0, 0,   0, 0,
        ]);

        // 索引数据：每个面2个三角形，6个面
        const indices = new Uint32Array([
            0,  1,  2,    0,  2,  3,  // front
            4,  5,  6,    4,  6,  7,  // back
            8,  9,  10,   8,  10, 11, // top
            12, 13, 14,   12, 14, 15, // bottom
            16, 17, 18,   16, 18, 19, // right
            20, 21, 22,   20, 22, 23  // left
        ]);

        return new FStaticMesh(vertices, indices);
    }

    /**
     * 创建球体网格
     * @param {number} radius - 半径
     * @param {number} segments - 分段数(经纬线数量)
     * @returns {FStaticMesh} 球体网格实例
     */
    static CreateSphere(radius = 1, segments = 32) {
        const vertexCount = (segments + 1) * (segments + 1);
        const indexCount = segments * segments * 6;
        
        // 每个顶点15个浮点数：position(3) + normal(3) + tangent(3) + uv0(2) + uv1(2) + uv2(2) + uv3(2)
        const vertices = new Float32Array(vertexCount * 15);
        const indices = new Uint32Array(indexCount);

        // 生成顶点
        let vertexIndex = 0;
        for (let lat = 0; lat <= segments; lat++) {
            const theta = lat * Math.PI / segments;
            const sinTheta = Math.sin(theta);
            const cosTheta = Math.cos(theta);

            for (let lon = 0; lon <= segments; lon++) {
                const phi = lon * 2 * Math.PI / segments;
                const sinPhi = Math.sin(phi);
                const cosPhi = Math.cos(phi);

                // 位置
                const x = cosPhi * sinTheta;
                const y = cosTheta;
                const z = sinPhi * sinTheta;

                // 计算切线
                const tx = -sinPhi;
                const ty = 0;
                const tz = cosPhi;

                // UV坐标
                const u = lon / segments;
                const v = lat / segments;

                const offset = vertexIndex * 15;
                
                // Position
                vertices[offset] = x * radius;
                vertices[offset + 1] = y * radius;
                vertices[offset + 2] = z * radius;
                
                // Normal (归一化的位置即为法线)
                vertices[offset + 3] = x;
                vertices[offset + 4] = y;
                vertices[offset + 5] = z;
                
                // Tangent
                vertices[offset + 6] = tx;
                vertices[offset + 7] = ty;
                vertices[offset + 8] = tz;
                
                // UV0
                vertices[offset + 9] = u;
                vertices[offset + 10] = v;
                
                // UV1, UV2, UV3 (复制UV0)
                vertices[offset + 11] = u;
                vertices[offset + 12] = v;
                vertices[offset + 13] = u;
                vertices[offset + 14] = v;

                vertexIndex++;
            }
        }

        // 生成索引
        let indexIndex = 0;
        for (let lat = 0; lat < segments; lat++) {
            for (let lon = 0; lon < segments; lon++) {
                const first = lat * (segments + 1) + lon;
                const second = first + segments + 1;

                indices[indexIndex++] = first;
                indices[indexIndex++] = second;
                indices[indexIndex++] = first + 1;

                indices[indexIndex++] = second;
                indices[indexIndex++] = second + 1;
                indices[indexIndex++] = first + 1;
            }
        }

        return new FStaticMesh(vertices, indices);
    }
}

export { FStaticMesh };