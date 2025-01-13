import FModuleManager from './Source/Core/FModuleManager';

class Main {
    static ModuleManager = null;

    static async Initialize() {
        try {
            // 获取模块管理器实例
            Main.ModuleManager = FModuleManager.GetInstance();

            // 启动系统
            await Main.ModuleManager.Initialize();

            console.log('System initialized:', Main.ModuleManager.GetSystemStatus());
        } catch (Error) {
            console.error('Initialization failed:', Error);
        }
    }
}

export default Main; 