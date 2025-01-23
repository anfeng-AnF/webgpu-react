import { EMeshType } from './EMeshType.js';

/**
 * IMesh interface defines the basic operations for all mesh types
 * @interface
 */
class IMesh {
    /**
     * Get vertex buffer
     * @returns {GPUBuffer} Vertex buffer
     */
    GetVertexBuffer() {
        throw new Error('GetVertexBuffer() must be implemented');
    }

    /**
     * Get index buffer
     * @returns {GPUBuffer} Index buffer
     */
    GetIndexBuffer() {
        throw new Error('GetIndexBuffer() must be implemented');
    }

    /**
     * Get index count
     * @returns {number} Number of indices
     */
    GetIndexCount() {
        throw new Error('GetIndexCount() must be implemented');
    }

    /**
     * Get mesh index for batch rendering
     * @returns {number} Mesh index
     */
    GetMeshIndex() {
        throw new Error('GetMeshIndex() must be implemented');
    }

    /**
     * Get mesh type (Static/Skeletal/Instanced)
     * @returns {EMeshType} Mesh type
     */
    GetMeshType() {
        throw new Error('GetMeshType() must be implemented');
    }

    /**
     * Get transform matrix
     * @returns {Float32Array} 4x4 transform matrix
     */
    GetTransform() {
        throw new Error('GetTransform() must be implemented');
    }

    /**
     * Set transform matrix
     * @param {Float32Array|number[]} matrix - 4x4 transform matrix
     */
    SetTransform(matrix) {
        throw new Error('SetTransform() must be implemented');
    }

    /**
     * Get material
     * @returns {Material} Material instance
     */
    GetMaterial() {
        throw new Error('GetMaterial() must be implemented');
    }

    /**
     * Update mesh state
     */
    Update() {
        throw new Error('Update() must be implemented');
    }

    /**
     * Destroy mesh resources
     */
    Destroy() {
        throw new Error('Destroy() must be implemented');
    }
}

export { IMesh }; 