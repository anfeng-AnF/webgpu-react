/**
 * MaterialSystem
 * 静态工具类，负责基于材质描述创建、更新和销毁材质实例。
 */
import GPUMaterial from './GPUMaterial.js';

//材质域
export const MaterialDomain = {
    //表面
    Surface: 0,
    //延迟贴花
    DeferredDecal: 1,
    //光照函数
    LightFunction: 2,
    //体积
    Volume: 3,
    //后期处理
    PostProcessing: 4,
    //用户界面
    UserInterface: 5,
};

// 混合模式
export const BlendMode = {
    // 不透明
    Opaque: 0,
    // 已遮罩
    Masked: 1,
    // 半透明
    Translucent: 2,
    // Additive
    Additive: 3,
    // 调制
    Modulate: 4,
    // 透明度合成（预乘透明度）
    Premultiplied: 5,
    // 透明度维持
    PreserveAlpha: 6,
};

// 着色模型
export const ShaderModel = {
    // 无光照（常量颜色）
    Unlit: 0,
    // 默认光照
    DefaultLit: 1,
    // 次表面散射
    Subsurface: 2,
};


/**
 * Cache mapping normalized material cache keys to GPUMaterial instances.
 * @type {Map<string, GPUMaterial>}
 */
const materialCache = new Map();

/**
 * 计算字符串的哈希值，使用简单的 djb2 算法
 * @param {string} str 
 * @returns {string} 哈希后的16进制字符串
 */
function hashString(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    }
    // 保证返回正数，并转换为16进制的字符串
    return (hash >>> 0).toString(16);
}

/**
 * 辅助函数：规范化材质描述，只取影响 GPU 资源创建的字段，
 * 如 shaderPath/shaderCode 与 pipelineDescriptor。
 * 这样即使 materialDesc 中存在额外不影响 GPU 的属性，也不会导致资源重复创建。
 * @param {Object} materialDesc - 材质描述对象
 * @returns {string} 标准化后的 JSON 字符串作为缓存 Key
 */
function getMaterialCacheKey(materialDesc) {
    const { shaderPath, shaderCode, pipelineDescriptor } = materialDesc;
    const str = JSON.stringify({ shaderPath, shaderCode, pipelineDescriptor });
    return hashString(str);
}

export default class MaterialSystem {
    /**
     * 根据指定的材质描述创建或获取一个 GPUMaterial 实例
     * @param {Object} materialDesc - 材质描述对象
     * @param {FResourceManager} resourceManager - GPU 资源管理器实例，用于创建和释放资源
     * @returns {GPUMaterial} 创建或缓存的材质实例
     */
    static async createMaterial(materialDesc, resourceManager) {
        // 使用 isSameMaterial 检查缓存中是否已有匹配的材质实例
        for (const cachedMaterial of materialCache.values()) {
            if (cachedMaterial.materialDesc.isSameMaterial(materialDesc)) {
                return cachedMaterial;
            }
        }
        // 没有匹配的材质，则新建
        const material = new GPUMaterial(materialDesc, resourceManager);
        await material.createRenderPipeline();
        await material.createBindGroup();
        // 使用材质实例自己的 materialId 作为缓存键
        materialCache.set(material.materialId, material);
        return material;
    }

    /**
     * 更新已有材质实例，同时更新缓存（旧的材质会从缓存中移除）
     * @param {GPUMaterial} material - 要更新的材质实例
     * @param {Object} materialDesc - 新的材质描述对象
     */
    static async updateMaterial(material, materialDesc) {
        // 从缓存中移除旧的材质对应的 key（若存在）
        for (const [cacheKey, cachedMat] of materialCache.entries()) {
            if (cachedMat === material) {
                materialCache.delete(cacheKey);
                break;
            }
        }

        material.destroy();
        material.materialDesc = materialDesc;
        await material.createRenderPipeline();
        await material.createBindGroup();
        const key = getMaterialCacheKey(materialDesc);
        materialCache.set(key, material);
    }

    /**
     * 销毁材质实例，并从缓存中删除
     * @param {GPUMaterial} material - 要销毁的材质实例
     */
    static disposeMaterial(material) {
        for (const [cacheKey, cachedMat] of materialCache.entries()) {
            if (cachedMat === material) {
                materialCache.delete(cacheKey);
                break;
            }
        }
        material.destroy();
    }

    /**
     * 获取指定材质描述对应的 GPUMaterial 实例（如果已缓存）
     * @param {Object} materialDesc - 材质描述对象
     * @returns {GPUMaterial|null} 缓存中的材质实例，如果不存在则返回 null
     */
    static getMaterial(materialDesc) {
         const key = getMaterialCacheKey(materialDesc);
         if (materialCache.has(key)) {
             return materialCache.get(key);
         }
         return null;
    }
} 