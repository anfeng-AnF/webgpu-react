/**
 * 网格类型枚举
 */
export const EMeshType = {
    Static: 'Static',         // 静态网格体
    Skeletal: 'Skeletal',     // 骨骼网格体
    Instanced: 'Instanced',   // 实例化网格体
};

/**
 * 基础网格类
 */
class FMesh {
    #Type;              // 网格类型
    #IsVisible = true;  // 可见性
    #IsTransparent = false; // 是否透明
    #VertexBuffer;      // 顶点缓冲
    #IndexBuffer;       // 索引缓冲
    #IndexCount;        // 索引数量
    #IndexBindGroup;    // 包含网格索引的绑定组
    #MeshIndex;         // 在变换缓冲区中的索引

    constructor(InType) {
        this.#Type = InType;
    }

    get Type() { return this.#Type; }
    get IsVisible() { return this.#IsVisible; }
    get IsTransparent() { return this.#IsTransparent; }
    get VertexBuffer() { return this.#VertexBuffer; }
    get IndexBuffer() { return this.#IndexBuffer; }
    get IndexCount() { return this.#IndexCount; }
    get IndexBindGroup() { return this.#IndexBindGroup; }
    get MeshIndex() { return this.#MeshIndex; }

    set IsVisible(Value) { this.#IsVisible = Value; }
    set IsTransparent(Value) { this.#IsTransparent = Value; }

    /**
     * 设置网格数据
     * @param {GPUBuffer} InVertexBuffer 顶点缓冲
     * @param {GPUBuffer} InIndexBuffer 索引缓冲
     * @param {number} InIndexCount 索引数量
     * @param {GPUBindGroup} InIndexBindGroup 包含网格索引的绑定组
     * @param {number} InMeshIndex 在变换缓冲区中的索引
     */
    SetMeshData(InVertexBuffer, InIndexBuffer, InIndexCount, InIndexBindGroup, InMeshIndex) {
        this.#VertexBuffer = InVertexBuffer;
        this.#IndexBuffer = InIndexBuffer;
        this.#IndexCount = InIndexCount;
        this.#IndexBindGroup = InIndexBindGroup;
        this.#MeshIndex = InMeshIndex;
    }

    /**
     * 销毁网格资源
     */
    Destroy() {
        // 由资源管理器处理具体的资源销毁
        this.#VertexBuffer = null;
        this.#IndexBuffer = null;
        this.#IndexBindGroup = null;
    }
}

export default FMesh; 