import IObjectBase from './ObjectBase';
import * as THREE from 'three';

class Object3D extends IObjectBase {
    constructor() {
        super();
        this.bIsObject3D = true;
        this.worldMatrix = new THREE.Matrix4();
        
        // 只保留UI需要的变换数据
        this.DynamicVariables = {
            WorldPosition: new THREE.Vector3(),
            WorldRotation: new THREE.Euler(),
            WorldScale: new THREE.Vector3(1, 1, 1)
        };
    }

    /**
     * 更新世界变换数据
     * @param {Object} worldTransform 包含世界空间的position, rotation, scale的对象
     */
    UpdateWorldTransform(worldTransform) {
        if (worldTransform) {
            this.DynamicVariables.WorldPosition.copy(worldTransform.position);
            this.DynamicVariables.WorldRotation.copy(worldTransform.rotation);
            this.DynamicVariables.WorldScale.copy(worldTransform.scale);
            
            this.worldMatrix.compose(
                this.DynamicVariables.WorldPosition,
                new THREE.Quaternion().setFromEuler(this.DynamicVariables.WorldRotation),
                this.DynamicVariables.WorldScale
            );
        }
    }

    /**
     * 获取变换矩阵
     * @returns {THREE.Matrix4}
     */
    GetTransformMatrix() {
        return this.worldMatrix;
    }
}

export default Object3D; 