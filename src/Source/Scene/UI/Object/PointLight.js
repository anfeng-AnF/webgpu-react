import Object3D from './Object3D';
import * as THREE from 'three';

class PointLight extends Object3D {
    constructor(name = '') {
        super();
        this.Name = name;
        this.Type = 'pointLight';
        this.uuid = ''; // GPU端对应的光源标识符

        // 只保留UI需要的数据
        this.DynamicVariables = {
            ...this.DynamicVariables,
            Color: new THREE.Color(1, 1, 1),
            Intensity: 1,
            Distance: 0,
            Decay: 2,
            CastShadow: false
        };
    }

    /**
     * 设置光源数据
     * @param {Object} lightData 包含color, intensity, distance, decay, castShadow的对象
     * @param {string} uuid GPU端对应的标识符
     */
    SetLightData(lightData, uuid) {
        if (lightData) {
            this.DynamicVariables.Color.copy(lightData.color);
            this.DynamicVariables.Intensity = lightData.intensity;
            this.DynamicVariables.Distance = lightData.distance;
            this.DynamicVariables.Decay = lightData.decay;
            this.DynamicVariables.CastShadow = lightData.castShadow;
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
            'Light.Distance': {
                value: this.DynamicVariables.Distance,
                label: '距离',
                onChange: (path, value) => {
                    this.DynamicVariables.Distance = value;
                    this.UpdateLight();
                }
            },
            'Light.Decay': {
                value: this.DynamicVariables.Decay,
                label: '衰减',
                onChange: (path, value) => {
                    this.DynamicVariables.Decay = value;
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

export default PointLight; 