import { EMeshType } from '../../Mesh/EMeshType.js';
import { MeshBatch } from './MeshBatch.js';
import FResourceManager, { EResourceType } from '../../Core/Resource/FResourceManager.js';
import { EarlyZPipelineDesc } from '../InitResource/DeferredRendering/ResourceConfig.js';
/**
 * Builder class for creating mesh batches
 */
class FMeshBatchBuilder {
    /**
     * Transform buffer alignment requirement
     * @type {number}
     */
    static TRANSFORM_ALIGNMENT = 256; // 假设为256字节对齐

    /**
     * Build batches from array of meshes
     * @param {Array<IMesh>} meshes 
     * @param {string} name - 批次的名称  如Early-z-pass的批次名称为Early-z-pass
     * @returns {Array<MeshBatch>}
     */
    static BuildBatches(meshes, name) {
        // 按材质和类型分组
        const groups = this.GroupByMaterialAndType(meshes);
        const batches = [];

        // 为每个组创建batch
        for (const [key, groupMeshes] of groups) {
            if (groupMeshes.length === 0) continue;

            const material = groupMeshes[0].GetMaterial();
            const type = groupMeshes[0].GetMeshType();
            const batch = this.CreateBatch(groupMeshes, material, type, name + type.toString());
            batches.push(batch);
        }

        return batches;
    }

    /**
     * Group meshes by material and type
     * @private
     * @param {Array<IMesh>} meshes 
     * @returns {Map<string, Array<IMesh>>}
     */
    static GroupByMaterialAndType(meshes) {
        const groups = new Map();

        for (const mesh of meshes) {
            const material = mesh.GetMaterial();
            const type = mesh.GetMeshType();
            // 使用材质ID和类型作为key
            const key = `${material?.id || 'default'}_${type}`;

            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key).push(mesh);
        }

        return groups;
    }

    /**
     * Generate a storage buffer for mesh transforms
     * @private
     * @param {Array<IMesh>} meshes 
     * @returns {string} 资源名
     */
    static GenerateMeshsTransformBuffer(meshes, name){
        // 根据这批Mesh创建Matrix的storageBuffer
        const matrixStorageBuffer = new Float32Array(meshes.length * 16);
        for(let index = 0; index < meshes.length; index++){
            const mesh = meshes[index];
            const matrix = mesh.GetTransform();
            matrixStorageBuffer.set(matrix, index * 16);
        }
        const meshTransformBuffer = FResourceManager.GetInstance().CreateResource(
            'MeshTransformBuffer'+name, {
            Type: EResourceType.Buffer,
            desc: {
                size: matrixStorageBuffer.byteLength    ,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
            }
        });
        new Float32Array(meshTransformBuffer.getMappedRange()).set(matrixStorageBuffer);
        meshTransformBuffer.unmap();

        return 'MeshTransformBuffer'+name;
    }

    /**
     * Create a batch for a group of meshes
     * @private
     * @param {Array<IMesh>} meshes 
     * @param {Material} material 
     * @param {EMeshType} type 
     * @returns {MeshBatch}
     */
    static CreateBatch(meshes, material, type, name) {
        const batch = new MeshBatch(meshes, material, type, name);

        const meshTransformBufferName = this.GenerateMeshsTransformBuffer(meshes, name);
        batch.SetTransformBuffer(meshTransformBufferName);
        
        // 设置EarlyZ Pass的pipeline和bindgroup
        this.SetupEarlyZPassResources(batch);
        
        // 设置EarlyZ Pass的绘制命令
        batch.SetDrawCommand((passEncoder, batch) => {
            const pipeline = batch.GetPipelineState('EarlyZPass');
            if (!pipeline) {
                console.warn('No pipeline state found for EarlyZPass');
                return;
            }

            // 设置pipeline
            passEncoder.setPipeline(pipeline);

            // 设置场景bindGroup (相机等)
            const sceneBindGroup = batch.GetBindGroup('SceneBindGroup');
            if (sceneBindGroup) {
                passEncoder.setBindGroup(0, sceneBindGroup);
            }

            // 设置Transform bindGroup
            const transformBindGroup = batch.GetBindGroup('MeshTransformBindGroup');
            if (transformBindGroup) {
                passEncoder.setBindGroup(1, transformBindGroup);
            }

            for(const mesh of batch.meshes){
                
                passEncoder.setVertexBuffer(0, mesh.GetVertexBuffer());
                passEncoder.setIndexBuffer(mesh.GetIndexBuffer(), 'uint32');

                passEncoder.drawIndexed(
                    mesh.GetIndexCount(),       // indexCount
                    1,                          // instanceCount
                    0,                          // firstIndex
                    0,                          // baseVertex
                    0                           // firstInstance
                );
            }
        });

        return batch;
    }

    /**
     * Setup EarlyZ Pass specific resources
     * @private
     * @param {MeshBatch} batch 
     */
    static SetupEarlyZPassResources(batch) {
        const resourceManager = FResourceManager.GetInstance();
        const type = batch.GetMeshType();
        const pipelineName = EarlyZPipelineDesc.GetResourceNames().Pipelines[type];
        // 设置pipeline
        batch.SetPipeline(pipelineName);

        // 设置BindGroups
        batch.SetBindGroup(EarlyZPipelineDesc.GetResourceNames().BindGroupLayouts.Scene);
        batch.SetBindGroup(EarlyZPipelineDesc.GetResourceNames().BindGroupLayouts.MeshTransform);
        
        // 如果是骨骼网格，还需要设置骨骼BindGroup
        if (type === EMeshType.Skeletal) {
            batch.SetBindGroup(EarlyZPipelineDesc.GetResourceNames().BindGroupLayouts.Bone);
        }
    }
}

export { FMeshBatchBuilder }; 