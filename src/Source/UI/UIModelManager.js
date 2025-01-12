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

    addListener(listener) {
        this.listeners.add(listener);
    }

    removeListener(listener) {
        this.listeners.delete(listener);
    }

    notifyListeners() {
        this.listeners.forEach(listener => listener());
    }

    // 添加或更新组件
    setComponent(area, section, component, renderFunction = null) {
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
        this.notifyListeners();
    }

    // 获取指定区域的组件
    getComponents(area, section, subSection = null) {
        if (subSection) {
            return this.components[area][section][subSection] || [];
        }
        return this.components[area][section] || [];
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