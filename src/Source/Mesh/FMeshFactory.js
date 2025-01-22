import FResourceManager from '../Core/Resource/FResourceManager.js';
import FMesh, { EMeshType } from './FMesh.js';
import FSkeletalMesh from './FSkeletalMesh.js';
import FMeshVertexFactory from './FMeshVertexFactory.js';

class FMeshFactory {
    static #Instance;
    #ResourceManager;
    #NextMeshIndex = 0;

    constructor() {
        this.#ResourceManager = FResourceManager.GetInstance();
    }

    static GetInstance() {
        if (!FMeshFactory.#Instance) {
            FMeshFactory.#Instance = new FMeshFactory();
        }
        return FMeshFactory.#Instance;
    }

    /**
     * 创建静态网格
     * @param {string} InName 网格名称
     * @param {Object} InMeshData 网格数据
     * @param {Float32Array} InMeshData.positions 位置数组
     * @param {Float32Array} InMeshData.normals 法线数组
     * @param {Float32Array} InMeshData.tangents 切线数组
     * @param {Float32Array} InMeshData.uvs UV数组
     * @param {Uint32Array} InIndices 索引数据
     * @returns {FMesh} 创建的网格实例
     */
    CreateStaticMesh(InName, InMeshData, InIndices) {
        const MeshIndex = this.#NextMeshIndex++;
        
        // 创建打包的顶点数据
        const vertices = FMeshVertexFactory.CreateStaticMeshVertices(
            InMeshData.positions,
            InMeshData.normals,
            InMeshData.tangents,
            InMeshData.uvs
        );

        // 创建顶点缓冲
        const VertexBuffer = this.#ResourceManager.CreateResource(`${InName}_VB`, {
            Type: 'Buffer',
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });
        new Float32Array(VertexBuffer.getMappedRange()).set(vertices);
        VertexBuffer.unmap();

        // 创建索引缓冲
        const IndexBuffer = this.#ResourceManager.CreateResource(`${InName}_IB`, {
            Type: 'Buffer',
            size: InIndices.byteLength,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });
        new Uint32Array(IndexBuffer.getMappedRange()).set(InIndices);
        IndexBuffer.unmap();

        // 创建网格索引绑定组
        const IndexBindGroup = this.#CreateMeshIndexBindGroup(InName, MeshIndex);

        // 创建网格实例
        const Mesh = new FMesh(EMeshType.Static);
        Mesh.SetMeshData(VertexBuffer, IndexBuffer, InIndices.length, IndexBindGroup, MeshIndex);

        return Mesh;
    }

    /**
     * 创建骨骼网格
     * @param {string} InName 网格名称
     * @param {Object} InMeshData 网格数据
     * @returns {FSkeletalMesh} 创建的骨骼网格实例
     */
    CreateSkeletalMesh(InName, InMeshData) {
        const MeshIndex = this.#NextMeshIndex++;
        
        // 创建基础顶点数据
        const vertices = FMeshVertexFactory.CreateStaticMeshVertices(
            InMeshData.positions,
            InMeshData.normals,
            InMeshData.tangents,
            InMeshData.uvs
        );
        
        // 创建骨骼数据
        const skeletalData = FMeshVertexFactory.CreateSkeletalData(
            InMeshData.boneIndices,
            InMeshData.boneWeights
        );

        // 创建基础网格数据
        const VertexBuffer = this.#CreateBuffer(`${InName}_VB`, vertices, GPUBufferUsage.VERTEX);
        const IndexBuffer = this.#CreateBuffer(`${InName}_IB`, InMeshData.indices, GPUBufferUsage.INDEX);
        const IndexBindGroup = this.#CreateMeshIndexBindGroup(InName, MeshIndex);

        // 创建骨骼网格实例
        const Mesh = new FSkeletalMesh();
        Mesh.SetMeshData(VertexBuffer, IndexBuffer, InMeshData.indices.length, IndexBindGroup, MeshIndex);
        Mesh.SetSkeletalData(skeletalData, null); // SkeletonBindGroup 需要在设置骨骼动画时创建

        return Mesh;
    }

    /**
     * 创建缓冲区
     * @private
     */
    #CreateBuffer(InName, InData, InUsage) {
        const Buffer = this.#ResourceManager.CreateResource(InName, {
            Type: 'Buffer',
            size: InData.byteLength,
            usage: InUsage | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });
        new (InData.constructor)(Buffer.getMappedRange()).set(InData);
        Buffer.unmap();
        return Buffer;
    }

    /**
     * 创建网格索引绑定组
     * @private
     */
    #CreateMeshIndexBindGroup(InName, InMeshIndex) {
        // 创建网格索引uniform buffer
        const IndexBuffer = this.#ResourceManager.CreateResource(`${InName}_MeshIndex`, {
            Type: 'Buffer',
            size: 4,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });
        new Uint32Array(IndexBuffer.getMappedRange())[0] = InMeshIndex;
        IndexBuffer.unmap();

        // TODO: 创建绑定组
        // 需要配合 BindGroupLayout 创建
        return null;
    }
}

export default FMeshFactory; 