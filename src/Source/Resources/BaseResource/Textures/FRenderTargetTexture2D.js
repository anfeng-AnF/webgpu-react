import FTexture2D, { ETexture2DUsage } from './FTexture2D';
import { ETextureFormat } from './FTexture';

/**
 * 渲染目标纹理类
 * 用于离屏渲染、后处理等
 */
class FRenderTargetTexture2D extends FTexture2D {
    /**
     * @param {GPUDevice} device - GPU设备
     * @param {Object} desc - 纹理描述符
     * @param {string} [desc.name] - 资源名称
     * @param {ETextureFormat} [desc.format=ETextureFormat.RGBA8_UNORM] - 纹理格式
     * @param {number} desc.width - 纹理宽度
     * @param {number} desc.height - 纹理高度
     * @param {number} [desc.sampleCount=1] - MSAA采样数
     * @param {GPUColor} [desc.clearValue] - 清除颜色
     * @param {boolean} [desc.clearOnBind=true] - 绑定时是否自动清除
     * @inheritdoc
     */
    constructor(device, desc) {
        super(device, {
            ...desc,
            usage: ETexture2DUsage.RENDER_TARGET | ETexture2DUsage.TEXTURE_BINDING
        });

        /**
         * 清除颜色
         * @type {GPUColor}
         */
        this.clearValue = desc.clearValue || { r: 0, g: 0, b: 0, a: 1 };

        /**
         * 绑定时是否自动清除
         * @type {boolean}
         */
        this.clearOnBind = desc.clearOnBind !== false;

        /**
         * MSAA采样数
         * @type {number}
         */
        this.sampleCount = desc.sampleCount || 1;

        if (this.sampleCount > 1) {
            this._createMSAATexture();
        }
    }

    /**
     * 创建MSAA纹理
     * @private
     */
    _createMSAATexture() {
        this._msaaTexture = this.device.createTexture({
            size: { width: this.width, height: this.height, depthOrArrayLayers: 1 },
            format: this.format,
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
            sampleCount: this.sampleCount
        });
    }

    /**
     * 清除渲染目标
     * @param {GPUCommandEncoder} encoder - 命令编码器
     */
    Clear(encoder) {
        const passDesc = {
            colorAttachments: [{
                view: this.sampleCount > 1 ? this._msaaTexture.createView() : this.GetView(),
                clearValue: this.clearValue,
                loadOp: 'clear',
                storeOp: 'store'
            }]
        };

        if (this.sampleCount > 1) {
            passDesc.colorAttachments[0].resolveTarget = this.GetView();
        }

        const pass = encoder.beginRenderPass(passDesc);
        pass.end();
    }

    /**
     * 创建渲染目标视图
     * @returns {GPUTextureView}
     */
    CreateRenderTargetView() {
        return this.sampleCount > 1 ? 
            this._msaaTexture.createView() : 
            this.GetView();
    }

    /**
     * 获取解析目标视图（用于MSAA）
     * @returns {GPUTextureView|null}
     */
    GetResolveTargetView() {
        return this.sampleCount > 1 ? this.GetView() : null;
    }

    /**
     * @override
     */
    Destroy() {
        if (this._msaaTexture) {
            this._msaaTexture.destroy();
            this._msaaTexture = null;
        }
        super.Destroy();
    }

    /**
     * 创建颜色渲染目标
     * @static
     * @param {GPUDevice} device - GPU设备
     * @param {number} width - 宽度
     * @param {number} height - 高度
     * @param {Object} [options] - 其他选项
     * @param {ETextureFormat} [options.format] - 纹理格式
     * @param {number} [options.sampleCount] - MSAA采样数
     * @param {GPUColor} [options.clearValue] - 清除颜色
     * @returns {Promise<FRenderTargetTexture2D>}
     */
    static async CreateColor(device, width, height, options = {}) {
        const texture = new FRenderTargetTexture2D(device, {
            width,
            height,
            format: options.format || ETextureFormat.RGBA8_UNORM,
            sampleCount: options.sampleCount,
            clearValue: options.clearValue
        });
        await texture.Initialize();
        return texture;
    }

    /**
     * 创建HDR渲染目标
     * @static
     * @param {GPUDevice} device - GPU设备
     * @param {number} width - 宽度
     * @param {number} height - 高度
     * @param {Object} [options] - 其他选项
     * @param {boolean} [options.highPrecision=false] - 是否使用高精度格式
     * @param {number} [options.sampleCount] - MSAA采样数
     * @returns {Promise<FRenderTargetTexture2D>}
     */
    static async CreateHDR(device, width, height, options = {}) {
        const format = options.highPrecision ? 
            ETextureFormat.RGBA32_FLOAT : 
            ETextureFormat.RGBA16_FLOAT;

        const texture = new FRenderTargetTexture2D(device, {
            width,
            height,
            format,
            sampleCount: options.sampleCount
        });
        await texture.Initialize();
        return texture;
    }
}

export default FRenderTargetTexture2D; 