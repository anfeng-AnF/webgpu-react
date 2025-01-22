import IModule from '../Core/IModule';
import React from 'react';
import FModuleManager from '../Core/FModuleManager';
import ViewportCanvas from '../UI/Components/MainContent/ViewportCanvas';
import { FSceneRenderer } from './FSceneRenderer';
import FResourceManager from '../Core/Resource/FResourceManager';
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
                id="RendererModuleViewportCanvas"
            />
        );
        FResourceManager.GetInstance().InitDevice(this.device);
        this.sceneRenderer = new FSceneRenderer(this.device);
        this.sceneRenderer.Initialize();
    }

    handleResize(width, height) {

    }

    handleCanvasReady(canvas) {
      
    }

    Update(DeltaTime) {

    }

    async Shutdown() {

    }
}

export default RendererModule;
