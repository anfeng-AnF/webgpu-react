import * as THREE from 'three';
import DetailBuilder from '../../../UI/Components/Details/DetailBuilder';


class IObjectBase {
    constructor() {
        this.Name = '';
        this.DynamicVariables = {

        };
        /**
         * @type {string}
         * staticMesh,filter,scene,directionalLight,pointLight,spotLight
         */
        this.Type = '';
        this.Parent = null;
        /**
         * @type {Map<string, IObjectBase>}
         */
        this.Children = new Map();
        this.Visible = true;
        this.bIsObject3D = false;

        /**
         * 对应GPUScene的Object的uuid
         * @type {string}
         */
        this.uuid = '';

        /**
         * 是否被选中
         * @type {boolean}
         */
        this.Selected = false;
    }

    /**
     * 添加子对象
     * @param {string} name 
     * @param {IObjectBase} child 
     */
    AddChild(name, child) {
        if (child) {
            child.Parent = this;
            this.Children.set(name, child);
        }
    }

    /**
     * 移除子对象
     * @param {string} name 
     */
    RemoveChild(name) {
        const child = this.Children.get(name);
        if (child) {
            child.Parent = null;
            this.Children.delete(name);
        }
    }

    /**
     * 设置可见性
     * @param {boolean} visible 
     */
    SetVisible(visible) {
        this.Visible = visible;
    }

    /**
     * 获取用于DetailBuilder的详细属性
     * @returns {Object} 详细属性
     */
    GetDetailProperties() {
        return {
            'Basic.Name': {
                value: this.Name,
                label: '名称',
                onChange: (path, value) => {
                    this.Name = value;
                }
            },
            'Basic.Type': {
                value: this.Type,
                label: '类型',
                readOnly: true
            },
            'Basic.Visible': {
                value: this.Visible,
                label: '可见',
                onChange: (path, value) => {
                    this.SetVisible(value);
                }
            }
        };
    }

    /**
     * 当对象被选中时调用
     */
    OnSelected() {
        this.Selected = true;
        // 获取DetailBuilder实例
        const detailBuilder = DetailBuilder.getInstance();
        // 清除现有属性
        detailBuilder.clear();
        // 添加新的属性
        detailBuilder.addProperties(this.GetDetailProperties());
    }

    /**
     * 当对象被取消选中时调用
     */
    OnDeselected() {
        this.Selected = false;
        // 获取DetailBuilder实例并清除属性
        DetailBuilder.getInstance().clear();
    }

    /**
     * 获取变换矩阵
     * @returns {THREE.Matrix4}
     */
    GetTransformMatrix() {
        return new THREE.Matrix4(); // 默认返回单位矩阵
    }

    /**
     * 更新世界矩阵
     */
    UpdateWorldMatrix() {
        // 基类中为空实现，由子类根据需要重写
    }
}

export default IObjectBase;
