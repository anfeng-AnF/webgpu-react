import FSceneRenderer from './FSceneRenderer';
import FResourceManager, { EResourceType } from '../../Core/Resource/FResourceManager';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import TestRenderer from './Test/TestRenderer';
import FCopyToCanvasPass from './Pass/PostProcess/FCopyToCanvasPass';
class FDeferredShadingSceneRenderer extends FSceneRenderer {
    constructor() {
        super();

        /**
         * 渲染通道
         * @type {Map<string, FDeferredShadingPass>}
         * @protected
         */
        this._Passes = new Map();

        /**
         * 资源管理器
         * @type {FResourceManager}
         * @protected
         */
        this._ResourceManager = null;

        /**
         * 主相机
         * @type {THREE.PerspectiveCamera}
         * @protected
         */
        this._MainCamera = null;

        /**
         * 场景
         * @type {THREE.Scene}
         * @protected
         */
        this._Scene = null;

        /**
         * 设备
         * @type {GPUDevice}
         * @protected
         */
        this._Device = null;
    }

    /**
     * 初始化渲染器
     */
    async Initialize() {
        this._Device = await FResourceManager.GetInstance().GetDevice();
        this._bInitialized = true;
    }

    /**
     * 画布尺寸变化
     * @param {number} Width 宽度
     * @param {number} Height 高度
     * @param {HTMLCanvasElement} Canvas 画布
     */
    async OnCanvasResize(Width, Height, Canvas) {
        if (this.testRenderer) {
            this.testRenderer.Resize(Width, Height);
        }

        if (this.FCopyToCanvasPass) {
            await this.FCopyToCanvasPass.OnRenderTargetResize(Width, Height);
        }

        this._bResizeCompleted = true;
    }

    /**
     * 画布准备完成
     * @param {HTMLCanvasElement} Canvas 画布
     */
    async OnCanvasReady(Canvas) {
        // 先初始化测试渲染器
        this.testRenderer = new TestRenderer();
        await this.testRenderer.Initialize(Canvas);

        // 初始化复制Pass
        this.FCopyToCanvasPass = new FCopyToCanvasPass('TestRenderTarget', Canvas);
        this.FCopyToCanvasPass = new FCopyToCanvasPass('TestDepthTexture', Canvas);
        await this.FCopyToCanvasPass.Initialize();

        this._bCanvasReady = true;
    }

    /**
     * 渲染场景
     * @param {number} DeltaTime 时间差
     */
    async Render(DeltaTime) {
        super.Render(DeltaTime);
        
        if (!this.testRenderer || !this.FCopyToCanvasPass) {
            return;
        }
        
        // 创建命令编码器
        const commandEncoder = this._Device.createCommandEncoder();
        
        // 调用测试渲染器的渲染，确保 DeltaTime 是毫秒单位
        const deltaTimeMs = DeltaTime * 1000;
        this.testRenderer.Render(deltaTimeMs, commandEncoder);
        this.FCopyToCanvasPass.Render(DeltaTime, commandEncoder);

        // 提交命令
        this._Device.queue.submit([commandEncoder.finish()]);
    }

    /**
     * 销毁渲染器
     */
    async Destroy() {
        if (this.testRenderer) {
            this.testRenderer.Destroy();
        }

        if (this.FCopyToCanvasPass) {
            this.FCopyToCanvasPass.Destroy();
        }
    }
}

export default FDeferredShadingSceneRenderer;
