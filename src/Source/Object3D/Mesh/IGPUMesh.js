/**
 * IGPUMesh
 * 这是一个抽象基类，用于定义 GPU Mesh 必须实现的接口方法，
 * 包括 `uploadToGPU` 用于上传资源到 GPU 以及 `destroy` 用于释放资源。
 */
export default class IGPUMesh {

    /**
     * GPU 顶点缓冲区
     * @type {GPUBuffer}
     */
    GPUVertexBuffer = null;
    /**
     * GPU 顶点缓冲区名称
     * @type {string}
     */
    #GPUVertexBufferName = '';
    /**
     * GPU 索引缓冲区
     * @type {GPUBuffer}
     */
    GPUIndexBuffer = null;
    /**
     * GPU 索引缓冲区名称
     * @type {string}
     */
    #GPUIndexBufferName = '';
    /**
     * GPU 资源管理器
     * @type {FResourceManager}
     */
    ResourceManager = null;

    constructor() {
        if (new.target === IGPUMesh) {
            throw new TypeError("Cannot instantiate IGPUMesh directly.");
        }
    }

    /**
     * 将 Mesh 资源上传到 GPU。
     * 子类需要提供具体实现，比如内部调用 createBuffers/updateBuffers 等方法。
     */
    uploadToGPU() {
        throw new Error("uploadToGPU() must be implemented by subclass.");
    }

    /**
     * 释放与此 Mesh 相关的所有 GPU 资源。
     * 子类需要提供具体实现。
     */
    destroy() {
        throw new Error("destroy() must be implemented by subclass.");
    }
} 