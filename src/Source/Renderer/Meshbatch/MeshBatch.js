import { EMeshType } from '../../Mesh/EMeshType.js';
import FResourceManager from '../../Core/Resource/FResourceManager.js';
import FDeferredRenderingResourceManager from '../InitResource/DeferredRendering/FDeferredRenderingResourceManager';
import { GPUIndexFormat } from 'three/src/renderers/webgpu/utils/WebGPUConstants';

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
        /** @type {string} */
        this.pipelineName = null;
        /** @type {Map<string, GPUBindGroup>} */
        this.bindGroups = new Map();

        // 绘制命令 回调函数
        this.MeshDrawCommand = null;

        this.deferredRenderingResourceManager = FDeferredRenderingResourceManager.GetInstance();
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
        this.pipelineName = PipelineName;
    }

    /**
     * Draw all meshes in batch
     * @param {GPURenderPassEncoder} passEncoder 
     * @param {string} passName 
     */
    Draw(passEncoder, passName) {
        if(this.Material) {
            this.material.draw(passEncoder, this.meshType, this.meshCount, this.transformBuffer);
        }
        else if(this.MeshDrawCommand)
        {
            //执行custom绘制
            this.MeshDrawCommand(passEncoder, this);
        }
        else {
            //执行默认绘制
            passEncoder.setPipeline(FResourceManager.GetInstance().GetResource(this.pipelineName));
            //slot 0  -- sceneBuffer
            passEncoder.setBindGroup(0,this.deferredRenderingResourceManager.GetSceneBindgroup());
            //slot 1  -- Instance/Transform Data
            ///...
            


            for(let i = 0; i < this.meshCount; i++) {
                //更新ModuleMatrix
                this.deferredRenderingResourceManager.UpdateModuleMatrices(this.meshes[i].GetTransform());

                passEncoder.setVertexBuffer(0,this.meshes[i].GetVertexBuffer());
                passEncoder.setIndexBuffer(this.meshes[i].GetIndexBuffer(),GPUIndexFormat.Uint32);

                passEncoder.drawIndexed(this.meshes[i].GetIndexCount(),1,0,0,0);
            }
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