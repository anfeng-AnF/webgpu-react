import Object3D from './Object3D';
import * as THREE from 'three';

class SceneStaticMesh extends Object3D {
    constructor(Mesh,name = '') {
        super();
        this.Name = name;
        this.Type = 'staticMesh';  // 设置类型为 staticMesh，对应 UI 中的静态网格图标
        this.bIsObject3D = true;   // 标记为 3D 对象

        // StaticMesh 特有的属性
        this.Position = new THREE.Vector3();
        this.Rotation = new THREE.Euler();
        this.Scale = new THREE.Vector3(1, 1, 1);

        // 用于标识对应的GPU端网格数据
        this.uuid = '';
        this.Mesh = Mesh;
    }

    /**
     * 设置网格对象的初始数据
     * @param {Object} meshData 包含position, rotation, scale的对象
     * @param {string} uuid GPU端对应的标识符
     */
    SetMeshData(meshData, uuid) {
        if (meshData) {
            this.Position.copy(meshData.position);
            this.Rotation.copy(meshData.rotation);
            this.Scale.copy(meshData.scale);
        }
        this.uuid = uuid;
    }

    /**
     * 更新变换
     */
    UpdateTransform() {
        if (this.Mesh) {
            this.Mesh.update(this);
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

    GetDetailProperties() {
        const baseProperties = super.GetDetailProperties();
        
        return {
            ...baseProperties,
            'Transform.Position': {
                value: [
                    this.Position.x,
                    this.Position.y,
                    this.Position.z
                ],
                label: '位置',
                onChange: (path, value) => {
                    this.Position.set(value[0], value[1], value[2]);
                    this.UpdateTransform();
                }
            },
            'Transform.Rotation': {
                value: [
                    this.Rotation.x * THREE.MathUtils.RAD2DEG,
                    this.Rotation.y * THREE.MathUtils.RAD2DEG,
                    this.Rotation.z * THREE.MathUtils.RAD2DEG
                ],
                label: '旋转',
                onChange: (path, value) => {
                    this.Rotation.set(
                        value[0] * THREE.MathUtils.DEG2RAD,
                        value[1] * THREE.MathUtils.DEG2RAD,
                        value[2] * THREE.MathUtils.DEG2RAD
                    );
                    this.UpdateTransform();
                }
            },
            'Transform.Scale': {
                value: [
                    this.Scale.x,
                    this.Scale.y,
                    this.Scale.z
                ],
                label: '缩放',
                onChange: (path, value) => {
                    this.Scale.set(value[0], value[1], value[2]);
                    this.UpdateTransform();
                }
            }
        };
    }

    /**
     * 获取变换矩阵
     * @returns {THREE.Matrix4}
     */
    GetTransformMatrix() {
        const matrix = new THREE.Matrix4();
        matrix.compose(this.Position, this.Rotation, this.Scale);
        return matrix;
    }
}

export default SceneStaticMesh;
