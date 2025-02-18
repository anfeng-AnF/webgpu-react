import * as THREE from 'three';
import DetailBuilder from '../UI/Components/Details/DetailBuilder.js';
/**
 * IObject3D 是 Object3D 的接口，用于管理 Object3D 的 UI 显示。
 * 
 */
class IObject3D extends THREE.Object3D {
    constructor() {
        super();
    }

    /**
     * 将对象的属性添加到 DetailBuilder
     * @param {DetailBuilder} detailBuilder DetailBuilder实例
     * @returns {this} 返回对象本身，支持链式调用
     */
    addToDetailBuilder(detailBuilder) {
        return this;
    }

    /**
     * 从 DetailBuilder 中移除对象的属性
     * @param {DetailBuilder} detailBuilder DetailBuilder实例
     * @returns {this} 返回对象本身，支持链式调用
     */
    removeFromDetailBuilder(detailBuilder) {
        return this;
    }

    /**
     * 更新 DetailBuilder 中的属性值
     * @param {DetailBuilder} detailBuilder DetailBuilder实例
     * @returns {this} 返回对象本身，支持链式调用
     */
    updateDetailBuilder(detailBuilder) {
        return this;
    }
}

export default IObject3D;

