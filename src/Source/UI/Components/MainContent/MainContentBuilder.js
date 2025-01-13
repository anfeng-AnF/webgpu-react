import React from 'react';
import './MainContent.css';

class MainContentBuilder {
    constructor(onChange) {
        this.onChange = onChange;
        this.components = new Map();
        this.layouts = new Map();
        this.listeners = new Set();
        this.activeLayout = null;
    }

    // 添加状态变化监听器
    addStateChangeListener(listener) {
        this.listeners.add(listener);
    }

    // 移除状态变化监听器
    removeStateChangeListener(listener) {
        this.listeners.delete(listener);
    }

    // 通知状态变化
    notifyStateChange(componentId, value) {
        this.listeners.forEach(listener => listener(componentId, value));
    }

    // 注册组件
    registerComponent(componentId, component, config = {}) {
        this.components.set(componentId, {
            component,
            config,
            visible: true,
            position: config.position || { x: 0, y: 0 },
            size: config.size || { width: 'auto', height: 'auto' }
        });
    }

    // 注册布局
    registerLayout(layoutId, layout) {
        console.log('Registering layout:', { layoutId, layout });
        this.layouts.set(layoutId, layout);
        this.notifyStateChange('layout', layoutId);
    }

    // 设置活动布局
    setActiveLayout(layoutId) {
        if (this.layouts.has(layoutId)) {
            this.activeLayout = layoutId;
            this.notifyStateChange('layout', layoutId);
        }
    }

    // 更新组件属性
    updateComponent(componentId, updates) {
        if (this.components.has(componentId)) {
            const component = this.components.get(componentId);
            this.components.set(componentId, {
                ...component,
                ...updates
            });
            this.notifyStateChange(componentId, updates);
        }
    }

    // 构建组件
    buildComponent(componentId) {
        console.log('MainContentBuilder.buildComponent()', {
            componentId,
            componentData: this.components.get(componentId)
        });

        const componentData = this.components.get(componentId);
        if (!componentData || !componentData.visible) return null;

        const { component: Component, config, position, size } = componentData;

        return (
            <div
                key={componentId}
                className="main-content-component"
                style={{
                    position: 'absolute',
                    left: position.x,
                    top: position.y,
                    width: size.width,
                    height: size.height,
                    ...config.style
                }}
            >
                <Component
                    {...config.props}
                    onChange={(value) => {
                        this.onChange?.(componentId, value);
                        this.notifyStateChange(componentId, value);
                    }}
                />
            </div>
        );
    }

    // 构建布局
    buildLayout() {
        console.log('MainContentBuilder.buildLayout()', {
            activeLayout: this.activeLayout,
            layout: this.layouts.get(this.activeLayout)
        });

        if (!this.activeLayout) return null;

        const layout = this.layouts.get(this.activeLayout);
        if (!layout) return null;

        return (
            <div className="main-content-layout">
                {layout.map((componentId) => {
                    console.log('Building component:', componentId);
                    return this.buildComponent(componentId);
                })}
            </div>
        );
    }

    // 构建整个内容区域
    build() {
        console.log('MainContentBuilder.build()', {
            activeLayout: this.activeLayout,
            layouts: this.layouts,
            components: this.components
        });

        return (
            <div className="main-content-container">
                {this.buildLayout()}
            </div>
        );
    }

    // 清除所有数据
    clear() {
        this.components.clear();
        this.layouts.clear();
        this.activeLayout = null;
    }

    // 获取当前活动布局
    getActiveLayout() {
        return this.activeLayout;
    }

    // 获取组件配置
    getComponent(componentId) {
        return this.components.get(componentId);
    }

    // 获取所有组件
    getAllComponents() {
        return Array.from(this.components.entries());
    }

    // 检查组件是否存在
    hasComponent(componentId) {
        return this.components.has(componentId);
    }

    // 移除组件
    removeComponent(componentId) {
        if (this.components.has(componentId)) {
            this.components.delete(componentId);
            this.notifyStateChange('remove', componentId);
        }
    }
}

export default MainContentBuilder; 