/**
 * 资源监控类
 * 用于监控和统计资源使用情况
 */
export class FResourceMonitor {
    constructor() {
        /**
         * 资源使用统计
         * @type {Map<string, {count: number, totalSize: number, peakCount: number, peakSize: number}>}
         * @private
         */
        this._stats = new Map();

        /**
         * 资源错误记录
         * @type {Array<{timestamp: number, type: string, message: string}>}
         * @private
         */
        this._errors = [];

        /**
         * 性能指标
         * @type {Map<string, number>}
         * @private
         */
        this._metrics = new Map();

        // 设置默认指标
        this._metrics.set('totalResourceCount', 0);
        this._metrics.set('totalResourceSize', 0);
        this._metrics.set('resourceCreationTime', 0);
        this._metrics.set('resourceLoadTime', 0);
    }

    /**
     * 记录资源创建
     * @param {string} type - 资源类型
     * @param {number} size - 资源大小（字节）
     */
    trackResourceCreation(type, size) {
        const stats = this._stats.get(type) || {
            count: 0,
            totalSize: 0,
            peakCount: 0,
            peakSize: 0
        };

        stats.count++;
        stats.totalSize += size;
        stats.peakCount = Math.max(stats.peakCount, stats.count);
        stats.peakSize = Math.max(stats.peakSize, stats.totalSize);

        this._stats.set(type, stats);
        this._metrics.set('totalResourceCount', this._metrics.get('totalResourceCount') + 1);
        this._metrics.set('totalResourceSize', this._metrics.get('totalResourceSize') + size);
    }

    /**
     * 记录资源销毁
     * @param {string} type - 资源类型
     * @param {number} size - 资源大小（字节）
     */
    trackResourceDestruction(type, size) {
        const stats = this._stats.get(type);
        if (stats) {
            stats.count--;
            stats.totalSize -= size;
            this._metrics.set('totalResourceCount', this._metrics.get('totalResourceCount') - 1);
            this._metrics.set('totalResourceSize', this._metrics.get('totalResourceSize') - size);
        }
    }

    /**
     * 记录资源错误
     * @param {string} type - 错误类型
     * @param {string} message - 错误信息
     */
    trackError(type, message) {
        this._errors.push({
            timestamp: Date.now(),
            type,
            message
        });

        // 只保留最近100条错误记录
        if (this._errors.length > 100) {
            this._errors.shift();
        }
    }

    /**
     * 记录性能指标
     * @param {string} name - 指标名称
     * @param {number} value - 指标值
     */
    trackMetric(name, value) {
        this._metrics.set(name, value);
    }

    /**
     * 获取资源统计信息
     * @returns {Object} 统计信息
     */
    getStats() {
        const stats = {};
        for (const [type, data] of this._stats.entries()) {
            stats[type] = { ...data };
        }
        return stats;
    }

    /**
     * 获取错误记录
     * @returns {Array} 错误记录
     */
    getErrors() {
        return [...this._errors];
    }

    /**
     * 获取性能指标
     * @returns {Object} 性能指标
     */
    getMetrics() {
        const metrics = {};
        for (const [name, value] of this._metrics.entries()) {
            metrics[name] = value;
        }
        return metrics;
    }

    /**
     * 生成资源使用报告
     * @returns {Object} 资源使用报告
     */
    generateReport() {
        return {
            timestamp: Date.now(),
            stats: this.getStats(),
            metrics: this.getMetrics(),
            recentErrors: this.getErrors(),
            summary: {
                totalResourceCount: this._metrics.get('totalResourceCount'),
                totalResourceSize: this._metrics.get('totalResourceSize'),
                errorCount: this._errors.length,
                resourceTypes: this._stats.size
            }
        };
    }

    /**
     * 清理监控数据
     */
    clear() {
        this._stats.clear();
        this._errors = [];
        this._metrics.clear();
    }
} 