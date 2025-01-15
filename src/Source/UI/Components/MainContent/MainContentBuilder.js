import React from 'react';
import Split from 'react-split';
import ViewportCanvas from './ViewportCanvas';
import './MainContentBuilder.css';

class MainContentBuilder {
    static instance = null;

    static getInstance(onChange) {
        if (!MainContentBuilder.instance) {
            MainContentBuilder.instance = new MainContentBuilder(onChange);
        }
        if (onChange) {
            MainContentBuilder.instance.onChange = onChange;
        }
        return MainContentBuilder.instance;
    }

    constructor(onChange) {
        // 防止直接实例化
        if (MainContentBuilder.instance) {
            throw new Error('MainContentBuilder is a singleton. Use MainContentBuilder.getInstance() instead.');
        }
        
        this.onChange = onChange;
        this.components = new Map(); // 存储所有组件
        this.layout = {
            toolbar: new Map(),    // 工具栏组件
            viewport: new Map(),   // 视口组件
            overlay: new Map()     // 覆盖层组件
        };
        
        // 视口布局配置
        this.viewportLayout = {
            direction: 'horizontal', // 分割方向：'horizontal' 或 'vertical'
            sizes: [],              // 每个视口的大小比例
            minSize: 100,           // 最小尺寸（像素）
            gutterSize: 4,          // 分隔条大小（像素）
        };
    }

    // 设置视口布局配置
    setViewportLayout(config) {
        this.viewportLayout = {
            ...this.viewportLayout,
            ...config
        };
        if (this.onChange) {
            this.onChange('viewportLayout.update', this.viewportLayout);
        }
    }

    // 添加组件到指定区域
    addComponent(area, path, component) {
        if (!this.layout[area]) {
            console.warn(`Unknown area: ${area}`);
            return;
        }

        this.layout[area].set(path, component);
        if (this.onChange) {
            this.onChange(`layout.${area}.add`, { path, component });
        }
    }

    // 移除组件
    removeComponent(area, path) {
        if (!this.layout[area]) {
            console.warn(`Unknown area: ${area}`);
            return;
        }

        this.layout[area].delete(path);
        if (this.onChange) {
            this.onChange(`layout.${area}.remove`, { path });
        }
    }

    // 构建工具栏区域
    buildToolbar() {
        return (
            <div className="viewport-toolbar">
                {Array.from(this.layout.toolbar, ([path, component]) => (
                    <React.Fragment key={path}>
                        {component}
                    </React.Fragment>
                ))}
            </div>
        );
    }

    // 构建视口区域
    buildViewport() {
        const viewports = Array.from(this.layout.viewport.entries());
        
        // 如果只有一个视口，直接返回
        if (viewports.length <= 1) {
            return (
                <div className="main-viewport">
                    {viewports.map(([path, component]) => (
                        <React.Fragment key={path}>
                            {component}
                        </React.Fragment>
                    ))}
                    <div className="viewport-overlay">
                        {Array.from(this.layout.overlay, ([path, component]) => (
                            <React.Fragment key={path}>
                                {component}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            );
        }

        // 如果没有设置sizes，根据视口数量平均分配
        if (this.viewportLayout.sizes.length !== viewports.length) {
            this.viewportLayout.sizes = viewports.map(() => 100 / viewports.length);
        }

        // 多个视口使用Split布局
        return (
            <div className="main-viewport">
                <Split
                    className={`split-layout ${this.viewportLayout.direction}`}
                    direction={this.viewportLayout.direction}
                    sizes={this.viewportLayout.sizes}
                    minSize={this.viewportLayout.minSize}
                    gutterSize={this.viewportLayout.gutterSize}
                    onDragEnd={(sizes) => {
                        this.viewportLayout.sizes = sizes;
                        if (this.onChange) {
                            this.onChange('viewportLayout.sizes', sizes);
                        }
                    }}
                >
                    {viewports.map(([path, component]) => (
                        <div key={path} className="split-panel">
                            {component}
                        </div>
                    ))}
                </Split>
                <div className="viewport-overlay">
                    {Array.from(this.layout.overlay, ([path, component]) => (
                        <React.Fragment key={path}>
                            {component}
                        </React.Fragment>
                    ))}
                </div>
            </div>
        );
    }

    // 构建整个主内容区域
    build() {
        return (
            <div className="main-content">
                {this.buildToolbar()}
                {this.buildViewport()}
            </div>
        );
    }

    // 清除所有组件
    clear(area) {
        if (area) {
            if (this.layout[area]) {
                this.layout[area].clear();
                if (this.onChange) {
                    this.onChange(`layout.${area}.clear`);
                }
            }
        } else {
            Object.keys(this.layout).forEach(key => {
                this.layout[key].clear();
            });
            if (this.onChange) {
                this.onChange('layout.clear');
            }
        }
    }

    // 重置实例（用于测试）
    static resetInstance() {
        MainContentBuilder.instance = null;
    }

    // 设置回调
    setOnChange(callback) {
        if (typeof callback === 'function') {
            this.onChange = callback;
        } else {
            console.warn('setOnChange expects a function as argument');
        }
    }

    // 获取指定区域的组件
    getComponent(area, path) {
        if (!this.layout[area]) {
            console.warn(`Unknown area: ${area}`);
            return null;
        }
        return this.layout[area].get(path);
    }

    // 获取组件的 DOM 元素
    getComponentElement(area, path) {
        const component = this.getComponent(area, path);
        if (!component) {
            console.warn(`Component not found: ${area}.${path}`);
            return null;
        }

        // 如果组件是 ViewportCanvas，通过 canvasId 查找
        if (component.type === ViewportCanvas) {
            const canvasId = component.props.canvasId;
            return document.getElementById(canvasId);
        }

        // 其他类型的组件，通过类名或ID查找
        const elementId = `${area}-${path}`.replace(/\./g, '-');
        return document.getElementById(elementId);
    }

    // 获取 Canvas 上下文
    getCanvasContext(canvasId, contextType = '2d') {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.warn(`Canvas not found with id: ${canvasId}`);
            return null;
        }

        try {
            return canvas.getContext(contextType);
        } catch (error) {
            console.error(`Failed to get ${contextType} context:`, error);
            return null;
        }
    }

    // 获取指定区域的所有组件
    getComponents(area) {
        if (!this.layout[area]) {
            console.warn(`Unknown area: ${area}`);
            return new Map();
        }
        return new Map(this.layout[area]);
    }

    // 检查组件是否存在
    hasComponent(area, path) {
        if (!this.layout[area]) {
            return false;
        }
        return this.layout[area].has(path);
    }

    // 获取组件数量
    getComponentCount(area) {
        if (!this.layout[area]) {
            return 0;
        }
        return this.layout[area].size;
    }
}

export default MainContentBuilder; 