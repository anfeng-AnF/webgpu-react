class UIModelManager {
    constructor() {
        this.components = {
            leftPanel: {
                actorList: [],
                categoryIcons: []
            },
            mainContent: {
                top: [],
                bottom: {
                    fileTree: [],
                    fileDetails: []
                }
            },
            rightPanel: {
                top: {
                    outlineTree: []
                },
                bottom: {
                    details: [],
                    worldSettings: []
                }
            }
        };
        this.listeners = new Set();
        this.renderFunctions = new Map();
    }

    // 添加或更新组件
    setComponent(area, section, component, renderFunction = null) {
        try {
            // 验证参数
            if (!this.components[area]) {
                throw new Error(`Invalid area: ${area}`);
            }
            if (!this.components[area][section]) {
                throw new Error(`Invalid section: ${section} in area: ${area}`);
            }
            
            if (typeof component === 'string') {
                // 如果是第三个参数是字符串，说明是新的调用方式
                const [name, comp] = [component, arguments[3]];
                this.components[area][section] = [comp];
            } else {
                // 原有的调用方式
                const [tab, comp] = component;
                
                // 存储渲染函数
                if (renderFunction) {
                    const key = `${area}-${section}-${tab}`;
                    this.renderFunctions.set(key, renderFunction);
                }

                switch(area) {
                    case 'leftPanel':
                        this.components.leftPanel[section] = [component];
                        break;
                    case 'mainContent':
                        if (section === 'bottom') {
                            const [subSection, comp] = component;
                            this.components.mainContent.bottom[subSection] = [comp];
                        } else {
                            this.components.mainContent[section] = [component];
                        }
                        break;
                    case 'rightPanel':
                        if (section === 'bottom') {
                            this.components.rightPanel.bottom[tab] = [comp];
                        } else {
                            this.components.rightPanel.top[section] = [component];
                        }
                        break;
                    default:
                        console.warn(`Unknown area: ${area}`);
                        break;
                }
            }
            this.notifyListeners();
        } catch (error) {
            console.error('Error in setComponent:', error);
            // 可以添加错误处理逻辑
        }
    }

    // 移除组件
    removeComponent(area, section, name) {
        if (!this.components[area] || !this.components[area][section]) {
            return;
        }

        // 如果是数组，清空它
        if (Array.isArray(this.components[area][section])) {
            this.components[area][section] = [];
        } else if (name && this.components[area][section][name]) {
            // 如果是对象且提供了名称，删除特定属性
            delete this.components[area][section][name];
        }

        this.notifyListeners();
    }

    // 获取指定区域的组件
    getComponents(area, section, subSection = null) {
        if (subSection) {
            return this.components[area][section][subSection] || [];
        }
        return this.components[area][section] || [];
    }

    addListener(listener) {
        this.listeners.add(listener);
    }

    removeListener(listener) {
        this.listeners.delete(listener);
    }

    notifyListeners() {
        this.listeners.forEach(listener => listener());
    }

    // 添加更新组件的方法
    updateComponent(area, section, tab) {
        const key = `${area}-${section}-${tab}`;
        const renderFunction = this.renderFunctions.get(key);
        if (renderFunction) {
            const newComponent = renderFunction();
            this.components[area][section][tab] = [newComponent];
            this.notifyListeners();
        }
    }
}

export default UIModelManager; 