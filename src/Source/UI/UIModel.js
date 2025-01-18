import React from 'react';
import ReactDOM from 'react-dom/client';
import Split from 'react-split';
import './UIModel.css';
import DetailBuilder from './Components/Details/DetailBuilder';
import IModule from '../Core/IModule';
import MainContentBuilder from './Components/MainContent/MainContentBuilder';

/**
 * UI模块类
 */
class UIModel extends IModule {
    constructor(Config) {
        super();
        this.Config = Config;
        this.Root = null;
        this.Component = null;
        this.DetailBuilder = DetailBuilder.getInstance(this.HandleStateChange);
        this.MainContentBuilder = MainContentBuilder.getInstance(this.HandleStateChange);
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
                    <MainPage 
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
class MainPage extends React.Component {
    componentCache = new Map();
    
    constructor(props) {
        super(props);
        this.state = {
            activeTab: 'details',
            updateCounter: 0
        };
        this.manager = props.manager;
        
        // 绑定 handleStateChange
        this.handleStateChange = this.handleStateChange.bind(this);
        this.detailBuilder = DetailBuilder.getInstance(this.handleStateChange);
        this.mainContentBuilder = MainContentBuilder.getInstance(this.handleStateChange);

        // 绑定画布事件处理器
        this.handleCanvasEvent = this.handleCanvasEvent.bind(this);
        this.mainContentBuilder = MainContentBuilder.getInstance(this.handleCanvasEvent);
    }

    // 实现 handleStateChange 方法
    handleStateChange = (path, value) => {
        // 触发重新渲染
        this.setState(prevState => ({
            updateCounter: prevState.updateCounter + 1
        }));
        
        // 如果需要，可以通过 manager 通知其他组件
        if (this.manager && typeof this.manager.onDetailChange === 'function') {
            this.manager.onDetailChange(path, value);
        }
    }

    handleCanvasEvent = (path, value) => {
        switch (path) {
            case 'canvas.ready':
                // 画布已就绪，可以开始渲染
                console.log('Canvas ready:', value);
                break;
            case 'canvas.resize':
                // 画布尺寸已改变
                console.log('Canvas resized:', value);
                break;
            case 'tools':
                // 工具状态改变
                console.log('Tools changed:', value);
                break;
            default:
                console.log('Main content event:', path, value);
        }

        // 触发重新渲染
        this.setState(prevState => ({
            updateCounter: prevState.updateCounter + 1
        }));
    }

    switchTab = (tabName) => {
        this.setState({ activeTab: tabName });
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
