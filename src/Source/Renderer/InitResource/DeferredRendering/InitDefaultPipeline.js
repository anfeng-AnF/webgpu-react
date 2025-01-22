import FResourceManager, { EResourceType } from '../../../Core/Resource/FResourceManager.js';
import { ResourceConfig, EarlyZPipelineDesc } from './ResourceConfig.js';

class InitDefaultPipeline {
    static #resourceManager = FResourceManager.GetInstance();
    static #Config = EarlyZPipelineDesc;

    /**
     * 初始化EarlyZ Pass的渲染管线
     */
    static async #InitializeEarlyZPipelines() {
        const resourceNames = this.#Config.GetResourceNames();

        // 创建着色器模块
        const shaderDesc = await this.#Config.GetShaderDesc();
        const shaderModule = this.#resourceManager.CreateResource(resourceNames.Shader, {
            Type: EResourceType.ShaderModule,
            desc: {
                code: shaderDesc.code
            }
        });

        if (!shaderModule) {
            console.error('Failed to create shader module');
            return;
        }

        // 创建绑定组布局
        const bindGroupLayouts = {};
        for (const [name, resourceName] of Object.entries(resourceNames.BindGroupLayouts)) {
            const descriptor = ResourceConfig.GetBindGroupLayout(name);
            if (!descriptor) {
                console.error(`Failed to get bind group layout descriptor for ${name}`);
                continue;
            }

            bindGroupLayouts[name] = this.#resourceManager.CreateResource(resourceName, {
                Type: EResourceType.BindGroupLayout,
                desc: descriptor
            });

            if (!bindGroupLayouts[name]) {
                console.error(`Failed to create bind group layout for ${name}`);
                return;
            }
        }

        // 创建管线布局
        const pipelineLayout = this.#resourceManager.CreateResource(resourceNames.PipelineLayout, {
            Type: EResourceType.PipelineLayout,
            desc: {
                bindGroupLayouts: Object.values(bindGroupLayouts)
            }
        });

        if (!pipelineLayout) {
            console.error('Failed to create pipeline layout');
            return;
        }

        // 创建各类型网格的管线
        for (const [type, pipelineName] of Object.entries(resourceNames.Pipelines)) {
            const pipelineDesc = await this.#Config.GetPipelineDesc(shaderModule, type, pipelineLayout);
            if (!pipelineDesc) {
                console.error(`Failed to get pipeline descriptor for ${type}`);
                continue;
            }

            const pipeline = this.#resourceManager.CreateResource(pipelineName, {
                Type: EResourceType.RenderPipeline,
                desc: pipelineDesc
            });

            if (!pipeline) {
                console.error(`Failed to create pipeline for ${type}`);
            }
        }
    }

    static async InitializeDeferredRenderPipeline() {
        await InitDefaultPipeline.#InitializeEarlyZPipelines();
    }
}

export default InitDefaultPipeline;