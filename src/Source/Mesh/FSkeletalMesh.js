import FMesh, { EMeshType } from './FMesh.js';

class FSkeletalMesh extends FMesh {
    #BoneWeightBuffer;
    #BoneIndexBuffer;
    #SkeletonBindGroup;

    constructor() {
        super(EMeshType.Skeletal);
    }

    get BoneWeightBuffer() { return this.#BoneWeightBuffer; }
    get BoneIndexBuffer() { return this.#BoneIndexBuffer; }
    get SkeletonBindGroup() { return this.#SkeletonBindGroup; }

    /**
     * 设置骨骼数据
     * @param {GPUBuffer} InBoneWeightBuffer 骨骼权重缓冲
     * @param {GPUBuffer} InBoneIndexBuffer 骨骼索引缓冲
     * @param {GPUBindGroup} InSkeletonBindGroup 骨骼绑定组
     */
    SetSkeletalData(InBoneWeightBuffer, InBoneIndexBuffer, InSkeletonBindGroup) {
        this.#BoneWeightBuffer = InBoneWeightBuffer;
        this.#BoneIndexBuffer = InBoneIndexBuffer;
        this.#SkeletonBindGroup = InSkeletonBindGroup;
    }

    Destroy() {
        super.Destroy();
        this.#BoneWeightBuffer = null;
        this.#BoneIndexBuffer = null;
        this.#SkeletonBindGroup = null;
    }
}

export default FSkeletalMesh; 