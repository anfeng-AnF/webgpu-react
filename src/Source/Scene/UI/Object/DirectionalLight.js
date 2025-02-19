import Object3D from './Object3D';
import * as THREE from 'three';

class DirectionalLight extends Object3D {
    constructor(name = '') {
        super();
        this.Name = name;
        this.Type = 'directionalLight';
        this.uuid = ''; // GPU端对应的光源标识符

        // 添加旋转属性
        this.Rotation = new THREE.Euler();

        // 只保留UI需要的数据
        this.DynamicVariables = {
            ...this.DynamicVariables,
            Color: new THREE.Color(1, 1, 1),
            Intensity: 1,
            CastShadow: false
        };
    }

    /**
     * 设置光源数据
     * @param {Object} lightData 包含color, intensity, castShadow, rotation的对象
     * @param {string} uuid GPU端对应的标识符
     */
    SetLightData(lightData, uuid) {
        if (lightData) {
            this.DynamicVariables.Color.copy(lightData.color);
            this.DynamicVariables.Intensity = lightData.intensity;
            this.DynamicVariables.CastShadow = lightData.castShadow;
            if (lightData.rotation) {
                this.Rotation.copy(lightData.rotation);
            }
        }
        this.uuid = uuid;
    }

    UpdateLight() {
        // 实现光源更新逻辑
    }

    GetDetailProperties() {
        const baseProperties = super.GetDetailProperties();
        
        return {
            ...baseProperties,
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
                    this.UpdateLight();
                }
            },
            'Light.Color': {
                value: this.DynamicVariables.Color.getHexString(),
                label: '颜色',
                onChange: (path, value) => {
                    this.DynamicVariables.Color.setHex(parseInt(value, 16));
                    this.UpdateLight();
                }
            },
            'Light.Intensity': {
                value: this.DynamicVariables.Intensity,
                label: '强度',
                onChange: (path, value) => {
                    this.DynamicVariables.Intensity = value;
                    this.UpdateLight();
                }
            },
            'Light.CastShadow': {
                value: this.DynamicVariables.CastShadow,
                label: '投射阴影',
                onChange: (path, value) => {
                    this.DynamicVariables.CastShadow = value;
                    this.UpdateLight();
                }
            }
        };
    }
}

export default DirectionalLight; 