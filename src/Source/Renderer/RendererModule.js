import IModule from '../Core/IModule';
import React from 'react';

/**
 * 渲染器模块
 */
class RendererModule extends IModule {
    constructor(Config) {
        super();
        this.Config = Config;
        this.Canvas = null;
        this.Context = null;
        this.bInitialized = false;
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
            return;
            const UIModule = this.ModuleManager.GetModule('UIModule');
            const mainContentBuilder = UIModule.GetMainContentBuilder();
            
            // 等待 UIModule 完全初始化
            const waitForUIModule = async () => {
                let attempts = 0;
                const maxAttempts = 10;
                
                while (attempts < maxAttempts) {
                    await new Promise(resolve => requestAnimationFrame(resolve));
                    const layout = mainContentBuilder.getActiveLayout();
                    if (layout) {
                        return true;
                    }
                    attempts++;
                }
                return false;
            };

            const uiReady = await waitForUIModule();
            if (!uiReady) {
                throw new Error('Timeout waiting for UIModule to be ready');
            }
            
            // 先获取当前布局
            const currentLayout = mainContentBuilder.getActiveLayout();

            // 创建Canvas组件
            const CanvasComponent = React.forwardRef((props, ref) => (
                <canvas
                    ref={ref}
                    id="renderCanvas"
                    style={{
                        width: '100%',
                        height: '100%',
                        display: 'block'
                    }}
                />
            ));

            // 创建一个ref来获取canvas元素
            this.canvasRef = React.createRef();

            // 注册Canvas组件到MainContent
            mainContentBuilder.registerComponent('renderCanvas', CanvasComponent, {
                position: { x: 0, y: 0 },
                size: { width: '100%', height: '100%' },
                props: {
                    ref: this.canvasRef
                }
            });

            const layoutComponents = mainContentBuilder.layouts.get(currentLayout) || [];
            // 确保不重复添加组件
            if (!layoutComponents.includes('renderCanvas')) {
                const newLayout = [...layoutComponents, 'renderCanvas'];
                console.log('Updating layout:', { currentLayout, newLayout });
                mainContentBuilder.registerLayout(currentLayout, newLayout);
            }

            // 强制UI组件更新
            if (UIModule.Component?.current) {
                UIModule.Component.current.forceUpdate();
                console.log('Forced UI update');
            }

            // 等待一帧让React完成渲染
            await new Promise(resolve => setTimeout(resolve, 0));

            // 获取Canvas元素
            this.Canvas = this.canvasRef.current;
            if (!this.Canvas) {
                throw new Error('Failed to get canvas element');
            }

            // 获取2D上下文
            this.Context = this.Canvas.getContext('2d');
            if (!this.Context) {
                throw new Error('Failed to get canvas context');
            }

            // 设置Canvas尺寸
            const updateCanvasSize = () => {
                if (!this.Canvas || !this.Canvas.parentElement) return;
                const { width, height } = this.Canvas.parentElement.getBoundingClientRect();
                this.Canvas.width = width * window.devicePixelRatio;
                this.Canvas.height = height * window.devicePixelRatio;
                this.Context.scale(window.devicePixelRatio, window.devicePixelRatio);
            };

            // 创建ResizeObserver
            this.resizeObserver = new ResizeObserver(updateCanvasSize);
            this.resizeObserver.observe(this.Canvas.parentElement);

            // 立即调用一次更新尺寸
            updateCanvasSize();

            this.bInitialized = true;
            console.log('RendererModule initialized');
        } catch (Error) {
            console.error('Failed to initialize RendererModule:', Error);
            throw Error;
        }
    }

    /**
     * 更新模块
     * @param {number} DeltaTime - 时间增量（秒）
     */
    Update(DeltaTime) {
        if (!this.bInitialized) return;

        // 简单的测试渲染
        this.Context.fillStyle = '#2c2c2c';
        this.Context.fillRect(0, 0, this.Canvas.width, this.Canvas.height);

        // 绘制一个移动的方块
        const time = performance.now() / 1000;
        const x = (Math.sin(time) + 1) * this.Canvas.width / 4 + this.Canvas.width / 4;
        const y = (Math.cos(time) + 1) * this.Canvas.height / 4 + this.Canvas.height / 4;

        this.Context.fillStyle = '#00ff00';
        this.Context.fillRect(x - 25, y - 25, 50, 50);
    }

    /**
     * 关闭模块
     * @returns {Promise<void>}
     */
    async Shutdown() {
        if (!this.bInitialized) return;

        try {
            // 清理ResizeObserver
            if (this.resizeObserver) {
                this.resizeObserver.disconnect();
            }

            // 从MainContent中移除Canvas组件
            const UIModule = this.ModuleManager.GetModule('UIModule');
            const mainContentBuilder = UIModule.GetMainContentBuilder();
            mainContentBuilder.removeComponent('renderCanvas');

            this.Canvas = null;
            this.Context = null;
            this.bInitialized = false;
            console.log('RendererModule shut down');
        } catch (error) {
            console.error('Error during RendererModule shutdown:', error);
            throw error;
        }
    }
}

export default RendererModule; 