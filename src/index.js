import './index.css';
import Main from './Main';

// 启动应用
Main.Initialize().catch(error => {
    console.error('Failed to start application:', error);
});

// 处理窗口关闭
window.addEventListener('beforeunload', () => {
    // 获取ModuleManager实例并关闭
    const moduleManager = Main.ModuleManager;
    if (moduleManager) {
        moduleManager.Shutdown();
    }
});