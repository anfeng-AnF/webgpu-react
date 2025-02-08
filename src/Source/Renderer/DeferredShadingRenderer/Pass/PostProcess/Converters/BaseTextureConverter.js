/**
 * 纹理转换器基类
 * 定义了将纹理转换到Canvas的基本接口
 */
class BaseTextureConverter {
    /**
     * @param {FResourceManager} resourceManager - 资源管理器实例
     * @param {string} passName - Pass名称，用于资源命名
     */
    constructor(resourceManager, passName) {
        this._ResourceManager = resourceManager;
        this._PassName = passName;
    }

    /**
     * 初始化转换器
     * @async
     * @param {string} sourceTextureName - 源纹理资源名称
     * @returns {Promise<void>}
     */
    async Initialize(sourceTextureName) {
        throw new Error('Initialize method must be implemented');
    }

    /**
     * 执行转换
     * @param {GPUCommandEncoder} commandEncoder - 命令编码器
     * @param {GPUTexture} sourceTexture - 源纹理
     * @param {GPUTexture} targetTexture - 目标纹理
     */
    Convert(commandEncoder, sourceTexture, targetTexture) {
        throw new Error('Convert method must be implemented');
    }

    /**
     * 处理目标大小改变
     * @async
     * @param {number} width - 新宽度
     * @param {number} height - 新高度
     * @returns {Promise<void>}
     */
    async OnResize(width, height) {
        throw new Error('OnResize method must be implemented');
    }

    /**
     * 销毁转换器资源
     * @async
     * @returns {Promise<void>}
     */
    async Destroy() {
        throw new Error('Destroy method must be implemented');
    }
}

export default BaseTextureConverter; 