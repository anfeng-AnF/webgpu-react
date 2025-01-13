import React from 'react';
import ReactDOM from 'react-dom/client';
import Split from 'react-split';
import './UIModel.css';
import UIModelManager from './UIModelManager';
import DetailBuilder from './Components/Details/DetailBuilder';
import IModule from '../Core/IModule';
import MainContentBuilder from './Components/MainContent/MainContentBuilder';
import MainContent from './Components/MainContent/MainContent';

/**
 * UI模块类
 */
class UIModel extends IModule {
    constructor(Config) {
        super();
        this.Config = Config;
        this.Root = null;
        this.Component = null;
        this.Manager = new UIModelManager();
        this.DetailBuilder = new DetailBuilder(this.HandleStateChange);
        this.MainContentBuilder = new MainContentBuilder(this.HandleStateChange);
        this.bInitialized = false;  // 添加初始化标志
    }

    /**
     * 初始化模块
     * @returns {Promise<void>}
     */
    async Initialize() {
        if (this.bInitialized) {
            console.warn('UIModel already initialized');
            return;
        }

        try {


            // 初始化React根节点
            const RootElementId = this.Config.Params.RootElementId || 'root';
            const rootElement = document.getElementById(RootElementId);

            // 检查是否已经有 Root 实例
            if (!this.Root) {
                this.Root = ReactDOM.createRoot(rootElement);
            }
            
            this.Component = React.createRef();


            // 渲染UI组件
            this.Root.render(
                <React.StrictMode>
                    <UIModelComponent 
                        ref={this.Component}
                        manager={this.Manager}
                        config={this.Config}
                    />
                </React.StrictMode>
            );

            this.bInitialized = true;
            console.log('UIModel initialized');
        } catch (Error) {
            console.error('Failed to initialize UIModel:', Error);
            throw Error;
        }
    }

    /**
     * 更新模块
     * @param {number} DeltaTime - 时间增量（秒）
     */
    Update(DeltaTime) {
        if (this.Component?.current) {
            this.Component.current.forceUpdate();
        }
    }

    /**
     * 关闭模块
     * @returns {Promise<void>}
     */
    async Shutdown() {
        if (!this.bInitialized) return;

        try {
            // 卸载React应用
            if (this.Root) {
                this.Root.unmount();
                this.Root = null;
                this.Component = null;
            }
            this.bInitialized = false;
            console.log('UIModel shut down');
        } catch (Error) {
            console.error('Failed to shutdown UIModel:', Error);
            throw Error;
        }
    }

    /**
     * 获取UI管理器
     * @returns {UIModelManager}
     */
    GetManager() {
        return this.Manager;
    }

    /**
     * 获取细节构建器
     * @returns {DetailBuilder}
     */
    GetDetailBuilder() {
        return this.DetailBuilder;
    }

    GetMainContentBuilder() {
        return this.MainContentBuilder;
    }
}

// UI组件类
class UIModelComponent extends React.Component {
    componentCache = new Map();
    
    constructor(props) {
        super(props);
        this.state = {
            activeTab: 'details',
            updateCounter: 0
        };
        this.manager = props.manager;
        this.detailBuilder = new DetailBuilder(this.handleStateChange);
        this.mainContentBuilder = new MainContentBuilder(this.handleStateChange);
        this.contentBuilder = props.config.ContentBuilder;

        // 初始化 MainContent
        this.initializeMainContent();
    }

    initializeMainContent() {
        console.log('Initializing MainContent');
        // 注册默认的MainContent组件
        this.mainContentBuilder.registerComponent('mainContent', MainContent, {
            position: { x: 0, y: 0 },
            size: { width: '100%', height: '100%' },
        });
        
        // 注册默认布局
        this.mainContentBuilder.registerLayout('default', ['mainContent']);
        this.mainContentBuilder.setActiveLayout('default');
        console.log('MainContent initialized');
    }

    componentDidMount() {
        this.manager.addListener(this.handleUpdate);
        // 确保布局已设置
        if (!this.mainContentBuilder.getActiveLayout()) {
            this.initializeMainContent();
        }
    }

    componentWillUnmount() {
        this.manager.removeListener(this.handleUpdate);
    }

    handleUpdate = () => {
        this.setState(state => ({
            updateCounter: state.updateCounter + 1
        }));
    }

    handleStateChange = (path, value) => {
        const pathParts = path.split('.');
        const key = pathParts.pop();
        const section = pathParts.join('.');

        this.setState(prevState => {
            let newState = { ...prevState };
            if (section) {
                let target = newState;
                const parts = section.split('.');
                for (const part of parts) {
                    target = target[part] = { ...target[part] };
                }
                target[key] = value;
            } else {
                newState[key] = value;
            }

            // 更新DetailBuilder中的值
            this.detailBuilder.updateProperty(path, value);

            return newState;
        }, () => {
            // 状态更新后强制重新渲染
            this.forceUpdate();
        });
    };

    // 更新所有属性
    updateAllProperties() {
        Object.entries(this.state).forEach(([key, value]) => {
            if (typeof value === 'object' && value !== null) {
                this.updateObjectProperties(key, value);
            } else {
                this.detailBuilder.updateProperty(key, value);
            }
        });
    }

    // 递归更新嵌套对象的属性
    updateObjectProperties(prefix, obj) {
        Object.entries(obj).forEach(([key, value]) => {
            const path = `${prefix}.${key}`;
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                this.updateObjectProperties(path, value);
            } else {
                this.detailBuilder.updateProperty(path, value);
            }
        });
    }

    switchTab = (tab) => {
        this.setState({ activeTab: tab });
    };

    memoizedBuildComponent = (path) => {
        if (!this.componentCache.has(path)) {
            this.componentCache.set(path, this.detailBuilder.buildComponent(path));
        }
        return this.componentCache.get(path);
    }

    render() {
        const { activeTab } = this.state;

        return (
            <div className="ui-model-container">
                <Split sizes={[20, 60, 20]} minSize={50} gutterSize={4} className="split-horizontal">
                    <div className="left-panel">
                        <div className="panel-header">
                            <h3>放置Actor</h3>
                            <button className="close-button">×</button>
                        </div>
                        <div className="search-box">
                            <input type="text" placeholder="搜索类" />
                        </div>
                        <div className="category-icons"></div>
                        <div className="actor-list">
                            {this.manager.getComponents('leftPanel', 'actorList').map((component, index) => (
                                <React.Fragment key={index}>{component}</React.Fragment>
                            ))}
                        </div>
                    </div>

                    <Split
                        direction="vertical"
                        sizes={[70, 30]}
                        minSize={50}
                        gutterSize={4}
                        className="main-content-container"
                    >
                        <div className="main-content-top">
                            {this.mainContentBuilder.build()}
                        </div>
                        <div className="main-content-bottom">
                            <div className="content-browser">
                                <div className="browser-content">
                                    <Split
                                        sizes={[30, 70]}
                                        minSize={100}
                                        gutterSize={4}
                                        className="split-horizontal file-management-split"
                                    >
                                        <div className="file-tree"></div>
                                        <div className="file-details">
                                            <div className="file-details-header">
                                                <div className="browser-search">
                                                    <input type="text" placeholder="搜索" />
                                                </div>
                                            </div>
                                            <div className="file-details-content"></div>
                                        </div>
                                    </Split>
                                </div>
                            </div>
                        </div>
                    </Split>

                    <Split
                        direction="vertical"
                        sizes={[30, 70]}
                        minSize={50}
                        gutterSize={4}
                        className="right-panel-container"
                    >
                        <div className="right-panel-top">
                            <div className="outline-header">
                                <div className="outline-controls">
                                    <span className="item-label">Item Label ▾</span>
                                    <span className="type-label">类型</span>
                                </div>
                                <div className="outline-search">
                                    <input type="text" placeholder="搜索" />
                                </div>
                            </div>
                            <div className="outline-content">
                                <div className="outline-tree">
                                    {this.manager.getComponents('rightPanel', 'top', 'outlineTree').map((component, index) => (
                                        <React.Fragment key={index}>{component}</React.Fragment>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="right-panel-bottom">
                            <div className="tab-header">
                                <button
                                    className={`tab-button ${activeTab === 'details' ? 'active' : ''}`}
                                    onClick={() => this.switchTab('details')}
                                >
                                    细节
                                </button>
                                <button
                                    className={`tab-button ${activeTab === 'worldSettings' ? 'active' : ''}`}
                                    onClick={() => this.switchTab('worldSettings')}
                                >
                                    世界场景设置
                                </button>
                            </div>
                            <div className="tab-content">
                                {activeTab === 'details' ? (
                                    <div className="details-content">
                                        {this.detailBuilder.build()}
                                    </div>
                                ) : (
                                    <div className="world-settings-content">
                                        {this.manager.getComponents('rightPanel', 'bottom', 'worldSettings').map((component, index) => (
                                            <React.Fragment key={index}>{component}</React.Fragment>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </Split>
                </Split>
            </div>
        );
    }
}

export default UIModel;
