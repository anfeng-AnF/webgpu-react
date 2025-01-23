import FPass, { EPassDependencyType } from './FPass.js';
import FResourceManager from '../../Core/Resource/FResourceManager.js';
import EarlyZPipelineDesc from '../InitResource/DeferredRendering/ResourceConfig.js';
import { EMeshType } from '../../Mesh/EMeshType.js';
import { MeshBatch } from '../Meshbatch/MeshBatch.js';

class FEarlyZPass extends FPass {
    #uniformBuffer;  // 包含所有Mesh索引的uniform buffer
    #alignedSize;    // 对齐后的uniform buffer偏移大小
    #ResourceManager;
    #ResourceNames;  // 资源名称配置

    constructor(InName = 'EarlyZPass') {
        super(InName);
        this.#ResourceManager = FResourceManager.GetInstance();
        this.#ResourceNames = EarlyZPipelineDesc.GetResourceNames();

        // 添加输出资源
        this.AddOutputResource('SceneDepth', {
            Description: '场景深度缓冲'
        });

        // 添加输入资源
        this.AddInputResource(this.#ResourceNames.BindGroupLayouts.Scene, {
            Description: '场景统一缓冲区(相机等数据)'
        });
        this.AddInputResource(this.#ResourceNames.BindGroupLayouts.MeshTransform, {
            Description: '所有网格的变换数据缓冲区'
        });

        // 添加固定资源 - 管线
        this.AddFixedResource(this.#ResourceNames.Pipelines.static, {
            Description: '静态网格深度预渲染管线'
        });
        this.AddFixedResource(this.#ResourceNames.Pipelines.skeletal, {
            Description: '骨骼网格深度预渲染管线'
        });
        this.AddFixedResource(this.#ResourceNames.Pipelines.instanced, {
            Description: '实例化网格深度预渲染管线'
        });

        // 添加固定资源 - 绑定组布局
        for (const [name, resourceName] of Object.entries(this.#ResourceNames.BindGroupLayouts)) {
            this.AddFixedResource(resourceName, {
                Description: `${name} bind group layout`
            });
        }
    }

    /**
     * 执行渲染通道
     * @param {GPURenderPassEncoder} InCommandEncoder 
     * @param {Array<MeshBatch>} InBatchedMeshes 
     */
    Execute(InCommandEncoder, InBatchedMeshes) {
        if (!this.ValidateResources()) {
            return;
        }

        const DepthTarget = this.GetResource('SceneDepth');
        const RenderPassDesc = {
            colorAttachments: [
                {
                    view: undefined,
                    clearValue: {r: 0, g: 0, b: 0, a: 0},
                    loadOp: 'clear',
                    storeOp: 'discard',
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

        for(const MeshBatch of InBatchedMeshes) {
            MeshBatch.Draw(PassEncoder, this.GetName());
        }

        PassEncoder.end();
    }
}

export { FEarlyZPass as default, EMeshType };