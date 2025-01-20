import { FResource } from '../FResource';
import { ResourceModule } from '../../ResourceModule';

/**
 * 绑定组类型枚举
 * @enum {string}
 */
export const EBindingType = {
    UNIFORM_BUFFER: 'uniform-buffer',
    STORAGE_BUFFER: 'storage-buffer',
    SAMPLED_TEXTURE: 'sampled-texture',
    STORAGE_TEXTURE: 'storage-texture',
    SAMPLER: 'sampler'
};

/**
 * 绑定组类
 * 管理资源的绑定和布局
 * 
 * @example
 * // 1. 基本使用 - 创建空绑定组并添加资源
 * const bindGroup = new FBindGroup(device, { 
 *     name: "materialBindGroup",
 *     visibility: GPUShaderStage.FRAGMENT 
 * });
 * 
 * // 使用链式调用添加绑定
 * bindGroup
 *     .addUniformBuffer(0, "materialBuffer")     // slot 0: uniform buffer
 *     .addSampledTexture(1, "albedoTexture")    // slot 1: texture
 *     .addSampledTexture(2, "normalTexture")    // slot 2: texture
 *     .addSampler(3, "defaultSampler");         // slot 3: sampler
 * 
 * // 2. 使用预设工厂方法
 * // 创建标准PBR材质绑定组
 * const materialGroup = FBindGroup.createMaterialGroup(device, "material", {
 *     materialParams: "materialParamsBuffer",
 *     albedoTexture: "albedoTex",
 *     normalTexture: "normalTex",
 *     sampler: "defaultSampler"
 * });
 * 
 * // 创建变换矩阵绑定组
 * const transformGroup = FBindGroup.createTransformGroup(device, "transform", {
 *     transformBuffer: "transformMatrixBuffer"
 * });
 * 
 * // 2. 在渲染管线中使用
 * // 创建管线布局
 * const pipelineLayout = device.createPipelineLayout({
 *     bindGroupLayouts: [
 *         transformGroup.getLayout(),  // group 0
 *         materialGroup.getLayout()    // group 1
 *     ]
 * });
 * 
 * // 创建渲染管线
 * const pipeline = device.createRenderPipeline({
 *     layout: pipelineLayout,
 *     vertex: {
 *         // ... 顶点着色器配置
 *     },
 *     fragment: {
 *         // ... 片段着色器配置
 *     }
 * });
 * 
 * // 在渲染通道中设置绑定组
 * const passEncoder = commandEncoder.beginRenderPass(renderPassDesc);
 * passEncoder.setPipeline(pipeline);
 * passEncoder.setBindGroup(0, transformGroup.getResource());  // 设置变换矩阵绑定组
 * passEncoder.setBindGroup(1, materialGroup.getResource());   // 设置材质绑定组
 * 
 * // 3. 对应的着色器代码
 * // Vertex Shader
 * // @group(0) @binding(0) var<uniform> transform: TransformUniforms;
 * // struct TransformUniforms {
 * //     modelMatrix: mat4x4f,
 * //     viewMatrix: mat4x4f,
 * //     projectionMatrix: mat4x4f,
 * // };
 * 
 * // Fragment Shader
 * // @group(1) @binding(0) var<uniform> material: MaterialUniforms;
 * // @group(1) @binding(1) var albedoTexture: texture_2d<f32>;
 * // @group(1) @binding(2) var normalTexture: texture_2d<f32>;
 * // @group(1) @binding(3) var textureSampler: sampler;
 * // struct MaterialUniforms {
 * //     baseColor: vec4f,
 * //     metallic: f32,
 * //     roughness: f32,
 * //     emissive: vec3f,
 * // };
 * 
 * // 4. 动态更新
 * // 更新单个资源
 * bindGroup.updateResource(1, "newAlbedoTexture");
 * 
 * // 移除绑定
 * bindGroup.removeBinding(2);  // 移除法线贴图绑定
 * 
 * // 添加新绑定
 * bindGroup.addSampledTexture(2, "roughnessTexture");
 * 
 * @note
 * 1. 绑定组创建后会自动管理其GPU资源的生命周期
 * 2. 资源名称必须在ResourceModule中已注册
 * 3. 修改绑定后需要重新获取GPU资源
 * 4. 绑定槽位(slot)对应着着色器中的 @binding(N)
 * 5. 绑定组索引(group)对应着着色器中的 @group(N)
 * 6. 绑定组布局必须与着色器声明匹配
 * 7. 一个渲染管线可以使用多个绑定组
 */
export class FBindGroup extends FResource {
    /**
     * @param {GPUDevice} device - GPU设备
     * @param {Object} desc - 绑定组描述符
     * @param {string} desc.name - 资源名称
     * @param {GPUShaderStageFlags} [desc.visibility] - 着色器可见性
     * @param {Array<Object>} [desc.entries] - 可选的初始绑定项数组
     */
    constructor(device, desc) {
        super(device, desc);
        
        this.entries = new Map();
        this.layout = null;
        this.visibility = desc.visibility || (GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT);
        
        // 如果提供了初始绑定项，则添加它们
        if (desc.entries) {
            desc.entries.forEach(entry => {
                this.addBinding(entry.slot, entry.type, entry.resourceName);
            });
        }
    }

    /**
     * 添加Uniform缓冲区绑定
     * @param {number} slot - 绑定槽位
     * @param {string} resourceName - 资源名称
     * @returns {FBindGroup} this，用于链式调用
     */
    addUniformBuffer(slot, resourceName) {
        this.addBinding(slot, EBindingType.UNIFORM_BUFFER, resourceName);
        return this;
    }

    /**
     * 添加存储缓冲区绑定
     * @param {number} slot - 绑定槽位
     * @param {string} resourceName - 资源名称
     * @returns {FBindGroup} this，用于链式调用
     */
    addStorageBuffer(slot, resourceName) {
        this.addBinding(slot, EBindingType.STORAGE_BUFFER, resourceName);
        return this;
    }

    /**
     * 添加采样纹理绑定
     * @param {number} slot - 绑定槽位
     * @param {string} resourceName - 资源名称
     * @returns {FBindGroup} this，用于链式调用
     */
    addSampledTexture(slot, resourceName) {
        this.addBinding(slot, EBindingType.SAMPLED_TEXTURE, resourceName);
        return this;
    }

    /**
     * 添加存储纹理绑定
     * @param {number} slot - 绑定槽位
     * @param {string} resourceName - 资源名称
     * @returns {FBindGroup} this，用于链式调用
     */
    addStorageTexture(slot, resourceName) {
        this.addBinding(slot, EBindingType.STORAGE_TEXTURE, resourceName);
        return this;
    }

    /**
     * 添加采样器绑定
     * @param {number} slot - 绑定槽位
     * @param {string} resourceName - 资源名称
     * @returns {FBindGroup} this，用于链式调用
     */
    addSampler(slot, resourceName) {
        this.addBinding(slot, EBindingType.SAMPLER, resourceName);
        return this;
    }

    /**
     * 添加绑定项
     * @param {number} slot - 绑定槽位
     * @param {EBindingType} type - 绑定类型
     * @param {string} resourceName - 资源名称
     */
    addBinding(slot, type, resourceName) {
        if (!this.validateBinding(slot, type, resourceName)) {
            throw new Error(`Invalid binding slot: ${slot}`);
        }

        this.entries.set(slot, { type, resourceName });
        this.layout = null; // 使布局失效，需要重新创建
        this.gpuResource = null; // 使绑定组失效，需要重新创建
    }

    /**
     * 移除绑定项
     * @param {number} slot - 绑定槽位
     */
    removeBinding(slot) {
        this.entries.delete(slot);
        this.layout = null;
    }

    /**
     * 更新绑定资源
     * @param {number} slot - 绑定槽位
     * @param {string} resourceName - 新的资源名称
     */
    updateResource(slot, resourceName) {
        const entry = this.entries.get(slot);
        if (!entry) {
            throw new Error(`Binding slot not found: ${slot}`);
        }

        const resource = ResourceModule.getInstance().getResource(resourceName);
        if (!this.validateResource(entry.type, resource)) {
            throw new Error(`Invalid resource for binding: ${slot}`);
        }

        entry.resourceName = resourceName;
        this.gpuResource = null; // 使绑定组失效，需要重新创建
    }

    /**
     * 创建GPU绑定组
     * @protected
     */
    create() {
        const resourceModule = ResourceModule.getInstance();
        const entries = Array.from(this.entries.entries()).map(([slot, entry]) => {
            const resource = resourceModule.getResource(entry.resourceName);
            return {
                slot,
                resource: this.getBindingResource(entry.type, resource)
            };
        });

        this.gpuResource = this.device.createBindGroup({
            layout: this.getLayout(),
            entries
        });
    }

    /**
     * 获取绑定组布局
     * @returns {GPUBindGroupLayout} 绑定组布局
     */
    getLayout() {
        if (!this.layout) {
            const entries = Array.from(this.entries.entries()).map(([slot, entry]) => ({
                slot,
                visibility: this.visibility,
                ...this.getBindingLayout(entry.type)
            }));

            this.layout = this.device.createBindGroupLayout({
                entries
            });
        }
        return this.layout;
    }

    /**
     * 获取绑定资源
     * @protected
     * @param {EBindingType} type - 绑定类型
     * @param {FResource} resource - 资源
     * @returns {GPUBindingResource} GPU绑定资源
     */
    getBindingResource(type, resource) {
        const gpuResource = resource.getResource();
        switch (type) {
            case EBindingType.UNIFORM_BUFFER:
            case EBindingType.STORAGE_BUFFER:
                return { buffer: gpuResource };
            case EBindingType.SAMPLED_TEXTURE:
            case EBindingType.STORAGE_TEXTURE:
                return resource.getView();
            case EBindingType.SAMPLER:
                return gpuResource;
            default:
                throw new Error(`Unknown binding type: ${type}`);
        }
    }

    /**
     * 获取绑定布局
     * @protected
     * @param {EBindingType} type - 绑定类型
     * @returns {Object} 绑定布局描述符
     */
    getBindingLayout(type) {
        switch (type) {
            case EBindingType.UNIFORM_BUFFER:
                return { buffer: { type: 'uniform' } };
            case EBindingType.STORAGE_BUFFER:
                return { buffer: { type: 'storage' } };
            case EBindingType.SAMPLED_TEXTURE:
                return { texture: { sampleType: 'float' } };
            case EBindingType.STORAGE_TEXTURE:
                return { storageTexture: { access: 'write-only', format: 'rgba8unorm' } };
            case EBindingType.SAMPLER:
                return { sampler: { type: 'filtering' } };
            default:
                throw new Error(`Unknown binding type: ${type}`);
        }
    }

    /**
     * 验证绑定项
     * @protected
     * @param {number} slot - 绑定槽位
     * @param {EBindingType} type - 绑定类型
     * @param {string} resourceName - 资源名称
     * @returns {boolean} 验证结果
     */
    validateBinding(slot, type, resourceName) {
        if (
            typeof slot !== 'number' ||
            slot < 0 ||
            !Object.values(EBindingType).includes(type) ||
            this.entries.has(slot)
        ) {
            return false;
        }

        try {
            const resource = ResourceModule.getInstance().getResource(resourceName);
            return this.validateResource(type, resource);
        } catch {
            return false;
        }
    }

    /**
     * 验证资源
     * @protected
     * @param {EBindingType} type - 绑定类型
     * @param {FResource} resource - 要验证的资源
     * @returns {boolean} 验证结果
     */
    validateResource(type, resource) {
        if (!(resource instanceof FResource)) return false;

        // 根据类型验证资源
        switch (type) {
            case EBindingType.UNIFORM_BUFFER:
            case EBindingType.STORAGE_BUFFER:
                return resource.getLayout().type === 'buffer';
            case EBindingType.SAMPLED_TEXTURE:
            case EBindingType.STORAGE_TEXTURE:
                return resource.getLayout().type === 'texture';
            case EBindingType.SAMPLER:
                return resource.getLayout().type === 'sampler';
            default:
                return false;
        }
    }

    // 静态工厂方法
    /**
     * 创建材质绑定组
     * @param {GPUDevice} device - GPU设备
     * @param {string} name - 资源名称
     * @param {Object} resourceNames - 材质资源名称
     * @returns {FBindGroup} 绑定组
     */
    static createMaterialGroup(device, name, resourceNames) {
        return new FBindGroup(device, { name })
            .addUniformBuffer(0, resourceNames.materialParams)
            .addSampledTexture(1, resourceNames.albedoTexture)
            .addSampledTexture(2, resourceNames.normalTexture)
            .addSampler(3, resourceNames.sampler);
    }

    /**
     * 创建变换矩阵绑定组
     * @param {GPUDevice} device - GPU设备
     * @param {string} name - 资源名称
     * @param {Object} resourceNames - 变换资源名称
     * @returns {FBindGroup} 绑定组
     */
    static createTransformGroup(device, name, resourceNames) {
        return new FBindGroup(device, { 
            name,
            visibility: GPUShaderStage.VERTEX 
        })
        .addUniformBuffer(0, resourceNames.transformBuffer);
    }
} 