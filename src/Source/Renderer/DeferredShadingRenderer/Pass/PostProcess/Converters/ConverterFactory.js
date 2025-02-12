import DirectCopyConverter from './DirectCopyConverter';
import ColorConverter from './ColorConverter';
import DepthConverter from './DepthConverter';

/**
 * 转换器工厂
 * 根据纹理格式创建对应的转换器
 */
class ConverterFactory {
    /**
     * 创建转换器
     * @param {string} format - 源纹理格式
     * @param {FResourceManager} resourceManager - 资源管理器
     * @param {string} passName - Pass名称
     * @returns {BaseTextureConverter} 转换器实例
     */
    static CreateConverter(format, resourceManager, passName) {
        switch (format) {
            case navigator.gpu.getPreferredCanvasFormat():
                return new DirectCopyConverter(resourceManager, passName);
            case 'rgba8unorm':
            case 'rgb10a2unorm':
                return new ColorConverter(resourceManager, passName, format);
            case 'depth32float':
                return new DepthConverter(resourceManager, passName, 'depth32float');
            case 'depth24plus':
                return new DepthConverter(resourceManager, passName, 'depth24plus');
            default:
                throw new Error(`Unsupported texture format: ${format}`);
        }
    }
}

export default ConverterFactory;
