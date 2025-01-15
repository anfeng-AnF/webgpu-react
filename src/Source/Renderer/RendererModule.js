import IModule from '../Core/IModule';
import React from 'react';
import FModuleManager from '../Core/FModuleManager';
import ViewportCanvas from '../UI/Components/MainContent/ViewportCanvas';

/**
 * 渲染器模块
 */
class RendererModule extends IModule {
  constructor(Config) {
    super();

  }

  /**
   * 初始化模块
   * @returns {Promise<void>}
   */
  async Initialize() {
    if (this.bInitialized) {
      console.warn('RendererModule already initialized');
      return;
    }

    try {
        const handleCanvasReady = (canvas) => {};
        const handleCanvasResize = (canvas) => {};
      const UIModel = FModuleManager.GetInstance().GetModule('UIModule');
      const mainContentBuilder = UIModel.GetMainContentBuilder();
      // 添加 ViewportCanvas
      mainContentBuilder.addComponent(
        'viewport',
        'ViewportCanvas2',
        <ViewportCanvas onCanvasReady={handleCanvasReady} onResize={handleCanvasResize} id="ViewportCanvas2" />
      );
    } catch (Error) {
      console.error('Failed to initialize RendererModule:', Error);
      throw Error;
    }
  }

  /**
   * 更新模块
   * @param {number} DeltaTime - 时间增量（秒）
   */
  Update(DeltaTime) {}

  /**
   * 关闭模块
   * @returns {Promise<void>}
   */
  async Shutdown() {
    if (!this.bInitialized) return;

    try {
      console.log('RendererModule shut down');
    } catch (error) {
      console.error('Error during RendererModule shutdown:', error);
      throw error;
    }
  }
}

export default RendererModule;
