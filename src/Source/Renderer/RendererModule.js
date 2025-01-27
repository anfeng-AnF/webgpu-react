import IModule from '../Core/IModule';
import React from 'react';
import FModuleManager from '../Core/FModuleManager';
import ViewportCanvas from '../UI/Components/MainContent/ViewportCanvas';
import FResourceManager from '../Core/Resource/FResourceManager';
import FDeferredShadingSceneRenderer from './DeferredShadingRenderer/FDeferredShadingSceneRenderer';
/**
 * 渲染器模块
 */
class RendererModule extends IModule {
    constructor() {
        super();
        this.adapter = null;
        this.device = null;
        this.canvas = null;
        this.context = null;
        this.sceneRenderer = null;
        this.moduleManager = FModuleManager.GetInstance();
        this.bInitialized = false;
    }

    async Initialize() {
        this.adapter = await navigator.gpu.requestAdapter();
        this.device = await this.adapter.requestDevice();

        if (!this.device) {
            throw new Error('Failed to initialize WebGPU device');
        }

        let UIModule = this.moduleManager.GetModule('UIModule');
        let mainContent = UIModule.GetMainContentBuilder();
        mainContent.addComponent(
            'viewport',
            'viewportCanvas2',
            <ViewportCanvas
                onResize={(width, height) => this.handleResize(width, height)}
                onCanvasReady={(canvas) => this.handleCanvasReady(canvas)}
                canvasId="RendererModuleViewportCanvas"
            />
        );
        FResourceManager.GetInstance().InitDevice(this.device);
        this.sceneRenderer = new FDeferredShadingSceneRenderer(this.device);
        this.sceneRenderer.Initialize();
    }

    handleResize(width, height) {
        this.sceneRenderer.OnCanvasResize(width, height);
    }

    handleCanvasReady(canvas) {
        this.sceneRenderer.OnCanvasReady(canvas);
    }

    Update(DeltaTime) {
        this.sceneRenderer.Render(DeltaTime);
    }

    async Shutdown() {

    }
}

export default RendererModule;
