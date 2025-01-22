import FPass, { EPassDependencyType } from '../../Core/Resource/FPass.js';
import FResourceManager from '../../Core/Resource/FResourceManager.js';
// 网格类型枚举
const EMeshType = {
    Static: 'Static',         // 静态网格体
    Skeletal: 'Skeletal',     // 骨骼网格体
    Instanced: 'Instanced',   // 实例化网格体
};

class FEarlyZPass extends FPass {
    #uniformBuffer;  // 包含所有Mesh索引的uniform buffer
    #alignedSize;    // 对齐后的uniform buffer偏移大小
    #ResourceManager;
    /**
     * @param {string} InName Pass名称
     */
    constructor(InName) {
        super(InName);
        this.#ResourceManager = FResourceManager.GetInstance();

        // 声明深度缓冲输出
        this.AddDependency('SceneDepth', EPassDependencyType.Output, {
            Description: '场景深度缓冲'
        });

        // 声明场景数据依赖
        this.AddDependency('SceneUniformBuffer', EPassDependencyType.Input, {
            Description: '场景统一缓冲区(相机等数据)'
        });

        // 声明不同类型网格的渲染管线
        this.AddDependency('StaticMeshEarlyZPipeline', EPassDependencyType.Input, {
            Description: '静态网格深度预渲染管线'
        });
        this.AddDependency('SkeletalMeshEarlyZPipeline', EPassDependencyType.Input, {
            Description: '骨骼网格深度预渲染管线'
        });
        this.AddDependency('InstancedMeshEarlyZPipeline', EPassDependencyType.Input, {
            Description: '实例化网格深度预渲染管线'
        });

        // 声明绑定组依赖
        this.AddDependency('EarlyZBindGroup', EPassDependencyType.Input, {
            Description: '深度预渲染绑定组'
        });

        // 添加存储所有Mesh变换数据的Storage Buffer依赖
        this.AddDependency('MeshTransformBuffer', EPassDependencyType.Input, {
            Description: '所有网格的变换数据缓冲区'
        });

        // 创建包含所有Mesh索引的uniform buffer
        this.#alignedSize = 256; // 需要根据实际设备限制调整
        const bufferSize = 1000 * this.#alignedSize; // 假设最多1000个mesh
        
        this.#uniformBuffer = this.#ResourceManager.CreateResource('MeshIndices', {
            Type: 'Buffer',
            size: bufferSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        // 初始化索引数据
        const indices = new Uint32Array(1000);
        for (let i = 0; i < 1000; i++) {
            indices[i] = i;
        }
        this.#ResourceManager.WriteBuffer(this.#uniformBuffer, indices);
    }

    /**
     * 渲染特定类型的网格批次
     * @param {GPURenderPassEncoder} PassEncoder 渲染通道编码器
     * @param {string} MeshType 网格类型
     * @param {Array} Meshes 网格数组
     * @param {GPUPipeline} Pipeline 渲染管线
     */
    #RenderMeshBatch(PassEncoder, MeshType, Meshes, Pipeline) {
        if (Meshes.length === 0) return;

        PassEncoder.setPipeline(Pipeline);
        
        // 设置场景数据
        PassEncoder.setBindGroup(0, this.GetResource('SceneBindGroup'));
        
        // 设置所有Mesh的变换矩阵
        PassEncoder.setBindGroup(1, this.GetResource('MeshTransformBindGroup'));

        for (const Mesh of Meshes) {
            // 计算当前Mesh的uniform buffer偏移
            const dynamicOffset = Mesh.MeshIndex * this.#alignedSize;
            
            // 设置当前Mesh的索引（使用动态偏移）
            PassEncoder.setBindGroup(2, this.GetResource('MeshIndexBindGroup'), [dynamicOffset]);

            PassEncoder.setVertexBuffer(0, Mesh.VertexBuffer);
            PassEncoder.setIndexBuffer(Mesh.IndexBuffer, 'uint32');

            if (MeshType === EMeshType.Skeletal) {
                PassEncoder.setVertexBuffer(1, Mesh.BoneWeightBuffer);
                PassEncoder.setVertexBuffer(2, Mesh.BoneIndexBuffer);
                PassEncoder.setBindGroup(3, Mesh.SkeletonBindGroup);
            }

            PassEncoder.drawIndexed(
                Mesh.IndexCount,
                MeshType === EMeshType.Instanced ? Mesh.InstanceCount : 1,
                0, 0, 0
            );
        }
    }

    /**
     * 执行Early-Z Pass
     * @param {GPUCommandEncoder} InCommandEncoder 命令编码器
     * @param {Object} InBatchedMeshes 按类型分组的网格 { Static: [], Skeletal: [], Instanced: [] }
     */
    Execute(InCommandEncoder, InBatchedMeshes) {
        if (!this.ValidateDependencies()) {
            return;
        }

        const DepthTarget = this.GetResource('SceneDepth');
        const BindGroup = this.GetResource('EarlyZBindGroup');
        const Pipelines = {
            [EMeshType.Static]: this.GetResource('StaticMeshEarlyZPipeline'),
            [EMeshType.Skeletal]: this.GetResource('SkeletalMeshEarlyZPipeline'),
            [EMeshType.Instanced]: this.GetResource('InstancedMeshEarlyZPipeline')
        };

        const RenderPassDesc = {
            colorAttachments: [
                {
                    view: undefined,  // 不需要颜色渲染目标
                    clearValue: {r: 0, g: 0, b: 0, a: 0},
                    loadOp: 'clear',  // 清除颜色缓冲区（如果有的话）
                    storeOp: 'discard', // 不需要存储颜色值
                },
            ],
            depthStencilAttachment: {
                view: DepthTarget.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
                depthWriteEnabled: true,
                depthCompare: 'less'
            }
        };

        const PassEncoder = InCommandEncoder.beginRenderPass(RenderPassDesc);
        PassEncoder.setBindGroup(0, BindGroup);

        // 按类型批量渲染
        for (const [Type, Pipeline] of Object.entries(Pipelines)) {
            const Meshes = InBatchedMeshes[Type];
            if (Meshes && Meshes.length > 0) {
                this.#RenderMeshBatch(PassEncoder, Type, Meshes, Pipeline);
            }
        }

        PassEncoder.end();
    }
}

export { FEarlyZPass as default, EMeshType };