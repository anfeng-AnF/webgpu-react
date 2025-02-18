import IObjectBase from './ObjectBase';
import * as THREE from 'three';

class SceneStaticMesh extends IObjectBase {
    constructor(name = '') {
        super();
        this.Name = name;
        this.Type = 'staticMesh';  // 设置类型为 staticMesh，对应 UI 中的静态网格图标
        this.bIsObject3D = true;   // 标记为 3D 对象

        // StaticMesh 特有的属性
        this.Mesh = null;          // THREE.Mesh 实例
        this.Material = null;      // 材质
        this.Position = new THREE.Vector3();
        this.Rotation = new THREE.Euler();
        this.Scale = new THREE.Vector3(1, 1, 1);
    }

    /**
     * 设置网格对象
     * @param {THREE.Mesh} mesh 
     */
    SetMesh(mesh) {
        this.Mesh = mesh;
        if (mesh) {
            this.Position.copy(mesh.position);
            this.Rotation.copy(mesh.rotation);
            this.Scale.copy(mesh.scale);
            this.Material = mesh.material;
        }
    }

    /**
     * 更新变换
     */
    UpdateTransform() {
        if (this.Mesh) {
            this.Mesh.position.copy(this.Position);
            this.Mesh.rotation.copy(this.Rotation);
            this.Mesh.scale.copy(this.Scale);
        }
    }

    /**
     * 设置可见性
     * @param {boolean} visible 
     */
    SetVisible(visible) {
        this.Visible = visible;
        if (this.Mesh) {
            this.Mesh.visible = visible;
        }
    }

    GetUIInfo() {
        return {
            ...super.GetUIInfo(),
            position: this.Position.toArray(),
            rotation: [
                this.Rotation.x * THREE.MathUtils.RAD2DEG,
                this.Rotation.y * THREE.MathUtils.RAD2DEG,
                this.Rotation.z * THREE.MathUtils.RAD2DEG
            ],
            scale: this.Scale.toArray(),
            visible: this.Visible,
            // 可以添加更多 UI 需要显示的信息
        };
    }
}

export default SceneStaticMesh;
