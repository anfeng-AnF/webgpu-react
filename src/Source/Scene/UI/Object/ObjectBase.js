import * as THREE from 'three';


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
     * 获取用于Detailbuilder的详细属性
     * @returns {Object} 详细属性
     */
    GetDetailProperties(){
        return {
        };
    }
}

export default IObjectBase;
