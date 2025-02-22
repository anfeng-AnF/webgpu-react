import FResourceManager from '../../../../Core/Resource/FResourceManager';
import FPass from '../Pass';
import { resourceName } from '../../ResourceNames';
import GPUScene from '../../../../Scene/GPUScene';

/**
 * 动态光照Pass，处理场景中的动态光源
 * 该pass渲染ShadowMap
 */
class DynamicLightPass extends FPass {
    constructor() {
        super();
        this._Name = 'DynamicLightPass';
    }

    /**
     * 初始化资源名称
     * 配置该Pass需要的资源
     */
    async InitResourceName() {
        this._Resources = {
            PassName: this._Name,
            Resources: {
                Dependence: {
                    Texture: [
                        resourceName.BasePass.gBufferA,
                        resourceName.BasePass.gBufferB,
                        resourceName.BasePass.gBufferC,
                        resourceName.BasePass.gBufferD,
                        resourceName.PrePass.depthTexture
                    ],
                },
                Managed: {
                    Texture: [this.lightResultTexture],
                    Pipeline: [this.lightPipeline],
                    BindGroupLayout: [this.lightBindGroupLayout],
                    BindGroup: [this.lightBindGroup]
                },
                Output: {
                    Texture: [this.lightResultTexture]
                }
            }
        };
    }

    /**
     * 初始化渲染通道
     * @param {FDeferredShadingSceneRenderer} renderer 渲染器
     */
    async Initialize(renderer) {
        // TODO: 实现初始化逻辑
    }

    /**
     * 处理渲染目标大小改变
     * @param {number} Width 宽度
     * @param {number} Height 高度
     */
    async OnRenderTargetResize(Width, Height) {
        // TODO: 实现渲染目标大小改变的处理
    }

    /**
     * 渲染
     * @param {number} DeltaTime 时间差
     * @param {GPUScene} Scene 场景
     * @param {GPUCommandEncoder} CommandEncoder 命令编码器
     * @param {FDeferredShadingSceneRenderer} renderer 渲染器
     */
    async Render(DeltaTime, Scene, CommandEncoder, renderer) {
        Scene.directLight.renderShadowMap(DeltaTime, Scene, CommandEncoder, renderer);
    }

    /**
     * 销毁资源
     */
    async Destroy() {
        // TODO: 实现资源销毁
    }
}

export default DynamicLightPass;
