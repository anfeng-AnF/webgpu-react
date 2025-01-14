/**
 * 资源缓存类
 * 用于管理资源的缓存和复用
 */
export class FResourceCache {
    constructor() {
        /**
         * 缓存映射表
         * @type {Map<string, {resource: any, lastAccess: number, refCount: number}>}
         * @private
         */
        this._cache = new Map();

        /**
         * 缓存大小限制（字节）
         * @type {number}
         * @private
         */
        this._sizeLimit = 512 * 1024 * 1024; // 默认512MB

        /**
         * 当前缓存大小（字节）
         * @type {number}
         * @private
         */
        this._currentSize = 0;
    }

    /**
     * 添加资源到缓存
     * @param {string} key - 缓存键
     * @param {any} resource - 资源对象
     * @param {number} size - 资源大小（字节）
     */
    add(key, resource, size) {
        // 如果资源已存在，更新访问时间
        if (this._cache.has(key)) {
            const entry = this._cache.get(key);
            entry.lastAccess = Date.now();
            entry.refCount++;
            return;
        }

        // 检查缓存大小，必要时清理旧资源
        while (this._currentSize + size > this._sizeLimit) {
            this._evictLeastRecentlyUsed();
        }

        // 添加新资源
        this._cache.set(key, {
            resource,
            size,
            lastAccess: Date.now(),
            refCount: 1
        });
        this._currentSize += size;
    }

    /**
     * 从缓存获取资源
     * @param {string} key - 缓存键
     * @returns {any|undefined} 资源对象
     */
    get(key) {
        const entry = this._cache.get(key);
        if (entry) {
            entry.lastAccess = Date.now();
            return entry.resource;
        }
        return undefined;
    }

    /**
     * 从缓存移除资源
     * @param {string} key - 缓存键
     * @returns {boolean} 是否成功移除
     */
    remove(key) {
        const entry = this._cache.get(key);
        if (entry) {
            entry.refCount--;
            if (entry.refCount <= 0) {
                this._currentSize -= entry.size;
                this._cache.delete(key);
                return true;
            }
        }
        return false;
    }

    /**
     * 清理所有缓存
     */
    clear() {
        this._cache.clear();
        this._currentSize = 0;
    }

    /**
     * 设置缓存大小限制
     * @param {number} sizeInBytes - 缓存大小限制（字节）
     */
    setSizeLimit(sizeInBytes) {
        this._sizeLimit = sizeInBytes;
        while (this._currentSize > this._sizeLimit) {
            this._evictLeastRecentlyUsed();
        }
    }

    /**
     * 获取缓存统计信息
     * @returns {Object} 统计信息
     */
    getStats() {
        return {
            totalSize: this._currentSize,
            sizeLimit: this._sizeLimit,
            itemCount: this._cache.size,
            usage: this._currentSize / this._sizeLimit
        };
    }

    /**
     * 清理最近最少使用的资源
     * @private
     */
    _evictLeastRecentlyUsed() {
        let oldestKey = null;
        let oldestAccess = Infinity;

        for (const [key, entry] of this._cache.entries()) {
            if (entry.refCount <= 0 && entry.lastAccess < oldestAccess) {
                oldestAccess = entry.lastAccess;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            const entry = this._cache.get(oldestKey);
            this._currentSize -= entry.size;
            this._cache.delete(oldestKey);
        }
    }
} 