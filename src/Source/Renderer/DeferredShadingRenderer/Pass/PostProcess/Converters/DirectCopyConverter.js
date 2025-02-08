import BaseTextureConverter from './BaseTextureConverter';

/**
 * 直接复制转换器
 * 用于格式完全匹配的情况
 */
class DirectCopyConverter extends BaseTextureConverter {
    async Initialize(sourceTextureName) {
        const sourceTexture = this._ResourceManager.GetResource(sourceTextureName);
        if (!(sourceTexture.usage & GPUTextureUsage.COPY_SRC)) {
            throw new Error('Direct copy is not supported for this texture without COPY_SRC usage');
        }
    }

    Convert(commandEncoder, sourceTexture, targetTexture) {
        commandEncoder.copyTextureToTexture(
            { texture: sourceTexture },
            { texture: targetTexture },
            [targetTexture.width, targetTexture.height, 1]
        );
    }

    async OnResize(width, height) {
        // 直接复制不需要特殊处理
    }

    async Destroy() {
        // 直接复制不需要清理资源
    }
}

export default DirectCopyConverter; 