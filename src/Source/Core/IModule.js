/**
 * 模块接口
 * @interface
 */
class IModule {
    /**
     * 初始化模块
     * @returns {Promise<void>}
     */
    async Initialize() {
        throw new Error('Method not implemented');
    }

    /**
     * 关闭模块
     * @returns {Promise<void>}
     */
    async Shutdown() {
        throw new Error('Method not implemented');
    }

    /**
     * 更新模块
     * @param {number} DeltaTime - 时间增量（秒）
     */
    Update(DeltaTime) {
        throw new Error('Method not implemented');
    }
}

export default IModule; 