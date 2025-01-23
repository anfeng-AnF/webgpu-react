import { EMeshType } from '../../Mesh/EMeshType.js';
import FResourceManager from '../../Core/Resource/FResourceManager.js';

/**
 * Manages a batch of meshes with same material and type
 */
class MeshBatch {
    /**
     * @param {Array<IMesh>} meshes - Array of meshes to batch
     * @param {Material} material - Shared material
     * @param {EMeshType} meshType - Type of meshes in batch
     * @param {string} name - Name of the batch
     */
    constructor(meshes, material, meshType, name) {
        /** @type {string} */
        this.name = name;
        /** @type {Array<IMesh>} */
        this.meshes = meshes;
        /** @type {Material} */
        this.material = material;
        /** @type {EMeshType} */
        this.meshType = meshType;
        /** @type {number} */
        this.meshCount = meshes.length;

        // GPU资源
        /** @type {GPUBuffer} */
        this.transformBuffer = null;
        /** @type {Float32Array} */
        this.transformData = null;
        /** @type {Map<string, GPUPipelineState>} */
        this.pipelineStates = new Map();
        /** @type {Map<string, GPUBindGroup>} */
        this.bindGroups = new Map();

        // 初始化
        this.CreateTransformBuffer();
        // 绘制命令 回调函数
        this.MeshDrawCommand = null;
    }

    /**
     * @returns {EMeshType}
     */
    GetMeshType() {
        return this.meshType;
    }

    /**
     * @returns {number}
     */
    GetMeshCount() {
        return this.meshCount;
    }

    /**
     * @returns {Material}
     */
    GetMaterial() {
        return this.material;
    }

    /**
     * @param {string} PipelineName 
     * @returns {GPUPipelineState}
     */
    GetPipelineState(PipelineName) {
        return this.pipelineStates.get(PipelineName);
    }

    /**
     * @returns {GPUBuffer}
     */
    GetTransformBuffer() {
        return this.transformBuffer;
    }

    /**
     * @param {string} BindGroupName 
     * @returns {GPUBindGroup}
     */
    GetBindGroup(BindGroupName) {
        return this.bindGroups.get(BindGroupName);
    }

    /**
     * @param {string} BindGroupName 
     */
    SetBindGroup(BindGroupName) {
        this.bindGroups.set(BindGroupName, FResourceManager.GetInstance().GetResource(BindGroupName));
    }

    /**
     * 设置绘制命令
     * @param {function} InDrawCommand 
     */
    SetDrawCommand(InDrawCommand) {
        this.MeshDrawCommand = InDrawCommand;
    }

    /**
     * 设置渲染管道
     * @param {string} PipelineName
     */
    SetPipeline(PipelineName){
        this.pipelineStates.set(PipelineName, FResourceManager.GetInstance().GetResource(PipelineName));
    }

    /**
     * Draw all meshes in batch
     * @param {GPURenderPassEncoder} passEncoder 
     * @param {string} passName 
     */
    Draw(passEncoder, passName) {
        if (!this.SetupDrawState(passEncoder, passName)) {
            return;
        }
        if(this.Material) {
            this.material.draw(passEncoder, this.meshType, this.meshCount, this.transformBuffer);
        }
        else
        {
            //执行默认绘制
            this.MeshDrawCommand(passEncoder, this);
        }
    }

    /**
     * Destroy batch resources
     */
    Destroy() {
        //该类不储存任何资源，资源由FResourceManager管理
    }
}

export { MeshBatch }; 