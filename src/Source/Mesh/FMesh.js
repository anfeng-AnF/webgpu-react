import { IMesh } from './IMesh.js';
import { EMeshType } from './EMeshType.js';

/**
 * Abstract base class for all mesh types
 * @abstract
 * @implements {IMesh}
 */
class FMesh extends IMesh{
    constructor() {
        super();
        // 几何数据
        /** @type {GPUBuffer} */
        this.vertexBuffer = null;
        /** @type {GPUBuffer} */
        this.indexBuffer = null;
        /** @type {number} */
        this.vertexCount = 0;
        /** @type {number} */
        this.indexCount = 0;
        /** @type {Float32Array} */
        this.transform = new Float32Array(16); // 4x4 matrix
        /** @type {BoundingBox} */
        this.boundingBox = null;
        /** @type {number} */
        this.meshIndex = -1;
        /** @type {EMeshType} */
        this.meshType = null;

        // 材质
        /** @type {Material} */
        this.material = null;
    }

    /**
     * @inheritdoc
     */
    GetVertexBuffer() {
        return this.vertexBuffer;
    }

    /**
     * @inheritdoc
     */
    GetIndexBuffer() {
        return this.indexBuffer;
    }

    /**
     * @inheritdoc
     */
    GetIndexCount() {
        return this.indexCount;
    }

    /**
     * @inheritdoc
     */
    GetMeshIndex() {
        return this.meshIndex;
    }

    /**
     * @inheritdoc
     */
    GetMeshType() {
        return this.meshType;
    }

    /**
     * @inheritdoc
     */
    GetTransform() {
        return this.transform;
    }

    /**
     * @inheritdoc
     */
    GetMaterial() {
        return this.material;
    }

    /**
     * Create vertex buffer
     * @protected
     * @abstract
     */
    CreateVertexBuffer() {
        throw new Error('CreateVertexBuffer() must be implemented');
    }

    /**
     * Create index buffer
     * @protected
     * @abstract
     */
    CreateIndexBuffer() {
        throw new Error('CreateIndexBuffer() must be implemented');
    }

    /**
     * @inheritdoc
     */
    Update() {
        // 子类可以覆盖此方法以提供自定义更新逻辑
    }

    /**
     * @inheritdoc
     */
    Destroy() {
        // 销毁GPU资源
        this.vertexBuffer?.destroy();
        this.indexBuffer?.destroy();
        
        // 清除引用
        this.vertexBuffer = null;
        this.indexBuffer = null;
        this.material = null;
    }

    /**
     * @inheritdoc
     */
    SetTransform(matrix) {
        // 确保输入是正确的大小
        if (matrix.length !== 16) {
            throw new Error('Transform matrix must be 4x4 (16 elements)');
        }
        
        // 如果输入是普通数组，转换为Float32Array
        if (Array.isArray(matrix)) {
            this.transform.set(matrix);
        } else {
            // 如果已经是 TypedArray，直接复制
            this.transform.set(matrix);
        }
    }
}

export { FMesh }; 