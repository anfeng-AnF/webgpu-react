import EventEmitter from 'events';
import IModule from './IModule';

/**
 * 模块管理器 - 系统启动和管理的主要接口
 */
class FModuleManager {
    constructor() {
        this.Modules = new Map();
        this.ModuleConstructors = new Map();
        this.Dependencies = new Map();
        this.Events = new EventEmitter();
        this.bInitialized = false;
        this.GlobalConfig = {
            bAutoInitialize: true,
            UpdateInterval: 16.67,
            Version: "1.0.0",
            Debug: {
                bShowLogs: true,
                LogLevel: "debug"
            }
        };
    }

    /**
     * 注册模块类型
     * @param {string} ModuleType - 模块类型名称
     * @param {Function} Constructor - 模块构造函数
     */
    RegisterModuleType(ModuleType, Constructor) {
        if (!(Constructor.prototype instanceof IModule)) {
            throw new Error(`Constructor must implement IModule interface`);
        }
        this.ModuleConstructors.set(ModuleType, Constructor);
        console.log(`Module type registered: ${ModuleType}`);
    }

    /**
     * 创建模块实例
     * @param {Object} Config - 模块配置
     * @returns {Promise<IModule>} 模块实例
     */
    async CreateModuleInstance(Config) {
        const Constructor = this.ModuleConstructors.get(Config.Name);
        if (!Constructor) {
            throw new Error(`Module type ${Config.Name} not registered`);
        }

        try {
            // 在创建实例前设置 ModuleManager 引用
            Config.ModuleManager = this;
            
            const Module = new Constructor(Config);
            if (!(Module instanceof IModule)) {
                throw new Error(`Created module must implement IModule interface`);
            }
            // 直接设置 ModuleManager 引用
            Module.ModuleManager = this;
            return Module;
        } catch (Error) {
            console.error(`Failed to create module ${Config.Name}:`, Error);
            throw Error;
        }
    }

    /**
     * 启动系统
     * @returns {Promise<void>}
     */
    async Initialize() {
        if (this.bInitialized) {
            console.warn('ModuleManager already initialized');
            return;
        }

        try {
            // 注册模块类型
            await this.RegisterModuleTypes();

            // 创建和初始化模块
            await this.CreateAndInitializeModules();

            // 如果配置了自动更新，启动更新循环
            if (this.GlobalConfig.bAutoInitialize) {
                this.StartUpdateLoop();
            }

            this.bInitialized = true;
            this.Events.emit('Initialized');
            console.log('System startup completed');
        } catch (Error) {
            console.error('System startup failed:', Error);
            await this.Shutdown();
            throw Error;
        }
    }

    /**
     * 注册所有模块类型
     * @private
     */
    async RegisterModuleTypes() {
        // 注册其他需要动态导入的模块
        const moduleTypes = {
            'UIModule': async () => {
                const module = await import('../UI/UIModel');
                return module.default;
            },
            'RendererModule': async () => {
                const module = await import('../Renderer/RendererModule');
                return module.default;
            }
        };

        for (const [name, importFunc] of Object.entries(moduleTypes)) {
            try {
                const moduleClass = await importFunc();
                this.RegisterModuleType(name, moduleClass);
            } catch (Error) {
                console.error(`Failed to register module type ${name}:`, Error);
                throw Error;
            }
        }
    }

    /**
     * 创建和初始化所有模块
     * @private
     */
    async CreateAndInitializeModules() {
        // 定义模块配置和依赖
        const ModuleConfigs = [
            {
                Name: 'UIModule',
                bEnabled: true,
                Priority: 100,
                Params: {
                    RootElementId: 'root',
                    DefaultTheme: 'dark',
                    Layout: {
                        LeftPanelWidth: 20,
                        RightPanelWidth: 20,
                        MinPanelSize: 50,
                        GutterSize: 4
                    }
                }
            },
            {
                Name: 'RendererModule',
                bEnabled: true,
                Priority: 90
            }
        ];

        this.Dependencies.set('UIModule', ['ResourceModule']);
        this.Dependencies.set('RendererModule', ['UIModule', 'ResourceModule']);

        // 按优先级排序
        ModuleConfigs.sort((a, b) => b.Priority - a.Priority);

        // 创建和初始化模块
        for (const Config of ModuleConfigs) {
            if (!Config.bEnabled) continue;

            try {
                const Module = await this.CreateModuleInstance(Config);
                this.Modules.set(Config.Name, Module);
                console.log(`Initializing module: ${Config.Name}`);
                await Module.Initialize();
                // 等待一帧确保资源就绪
                await new Promise(resolve => requestAnimationFrame(resolve));
            } catch (Error) {
                console.error(`Failed to initialize module ${Config.Name}:`, Error);
                throw Error;
            }
        }
    }

    /**
     * 获取模块的依赖顺序
     * @private
     * @returns {string[]} 排序后的模块名称列表
     */
    GetDependencyOrder() {
        const Visited = new Set();
        const Order = [];

        const Visit = (Name) => {
            if (Visited.has(Name)) return;
            Visited.add(Name);

            const Deps = this.Dependencies.get(Name) || [];
            for (const Dep of Deps) {
                if (!this.Modules.has(Dep)) {
                    throw new Error(`Missing dependency: ${Dep} required by ${Name}`);
                }
                Visit(Dep);
            }

            Order.push(Name);
        };

        for (const Name of this.Modules.keys()) {
            Visit(Name);
        }

        return Order;
    }

    /**
     * 启动更新循环
     * @private
     */
    StartUpdateLoop() {
        let LastTime = performance.now();
        let AnimationFrameId = null;

        const Loop = (CurrentTime) => {
            if (!this.bInitialized) {
                if (AnimationFrameId) {
                    cancelAnimationFrame(AnimationFrameId);
                }
                return;
            }

            const DeltaTime = (CurrentTime - LastTime) / 1000.0;
            LastTime = CurrentTime;

            this.UpdateAll(DeltaTime);

            AnimationFrameId = requestAnimationFrame(Loop);
        };

        AnimationFrameId = requestAnimationFrame(Loop);
    }

    /**
     * 更新所有模块
     * @param {number} DeltaTime - 时间增量（秒）
     */
    UpdateAll(DeltaTime) {
        if (!this.bInitialized) return;

        for (const [Name, Module] of this.Modules) {
            try {
                Module.Update(DeltaTime);
            } catch (Error) {
                console.error(`Error updating module ${Name}:`, Error);
            }
        }
    }

    /**
     * 获取模块实例
     * @template T
     * @param {string} ModuleName - 模块名称
     * @returns {T} 模块实例
     */
    GetModule(ModuleName) {
        const Module = this.Modules.get(ModuleName);
        if (!Module) {
            throw new Error(`Module ${ModuleName} not found`);
        }
        return Module;
    }

    /**
     * 关闭系统
     * @returns {Promise<void>}
     */
    async Shutdown() {
        if (!this.bInitialized) return;

        console.log('Shutting down system...');
        
        // 停止更新循环
        this.bInitialized = false;

        // 按照相反的优先级顺序关闭模块
        const Order = this.GetDependencyOrder().reverse();
        for (const Name of Order) {
            const Module = this.Modules.get(Name);
            try {
                console.log(`Shutting down module: ${Name}`);
                await Module.Shutdown();
            } catch (Error) {
                console.error(`Error shutting down module ${Name}:`, Error);
            }
        }

        this.Modules.clear();
        this.Dependencies.clear();
        this.GlobalConfig = null;
        this.Events.emit('Shutdown');
        console.log('System shutdown completed');
    }

    /**
     * 获取系统状态
     * @returns {Object} 系统状态信息
     */
    GetSystemStatus() {
        return {
            bInitialized: this.bInitialized,
            ModuleCount: this.Modules.size,
            ActiveModules: Array.from(this.Modules.keys()),
            Version: this.GlobalConfig?.Version || '0.0.0'
        };
    }

    // 单例模式
    static Instance = null;
    static GetInstance() {
        if (!FModuleManager.Instance) {
            FModuleManager.Instance = new FModuleManager();
        }
        return FModuleManager.Instance;
    }
}

export default FModuleManager; 