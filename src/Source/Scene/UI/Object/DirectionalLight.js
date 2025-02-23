import Object3D from './Object3D';
import * as THREE from 'three';

class DirectionalLight extends Object3D {
    constructor(GPULight,name = '') {
        super();
        this.Name = name;
        this.GPULight = GPULight;
        this.Type = 'directionalLight';
        this.uuid = ''; // GPU端对应的光源标识符

        // 修改DynamicVariables以匹配FDirectionalLight
        this.DynamicVariables = {
            lightDirection: new THREE.Vector3(-0.5, -1, -0.5), // 默认光照方向
            color: new THREE.Color(1.0, 1.0, 1.0), // 颜色
            intensity: 1.0, // 强度
    
            // 级联阴影
            numCascades: 8, // 级联数量
            cascadeLightBias: new Float32Array(8), // 级联深度偏移
            cascadeNormalBias: new Float32Array(8), // 级联法线偏移
            splitThreshold: 0.002, // 级联分割的线性/对数混合阈值
            size: 1024, // 每张阴影贴图边长
            cascadeNear: 0.1, // 级联相机近平面
            farMultiplier: 3.0, // 级联相机远平面 = radius * farMultiplier
            farOffset: 20.0, // 级联相机远平面额外偏移
    
            // 控制参数
            bShowCascade: false,
        
            // UI独有
            rotation: new THREE.Vector3(0, 0, 0),
        };
        
        this.#UpdateRotation();

        // 初始化默认的级联偏移值
        const cascadeLightBiasValues = [
            0.01,    // 级联0
            0.02,    // 级联1
            0.04,    // 级联2
            0.632,   // 级联3
            0.887,   // 级联4
            5.37,    // 级联5
            0.64,    // 级联6
            1.28     // 级联7
        ];

        const cascadeNormalBiasValues = [
            2.0,     // 级联0
            4.0,     // 级联1
            8.0,     // 级联2
            6.0,    // 级联3
            3.16,    // 级联4
            6.241,   // 级联5
            200.0,   // 级联6
            256.0    // 级联7
        ];

        // 设置级联偏移值
        for (let i = 0; i < this.DynamicVariables.numCascades; i++) {
            this.DynamicVariables.cascadeLightBias[i] = cascadeLightBiasValues[i] * 0.001;  // 转换为实际值
            this.DynamicVariables.cascadeNormalBias[i] = cascadeNormalBiasValues[i] * 0.001; // 转换为实际值
        }
    }

    /**
     * 根据光源方向更新旋转 (0,-1,0)为初始方向
     */
    #UpdateRotation() {
        // 光照方向是从光源指向场景的方向
        const dir = this.DynamicVariables.lightDirection;
        
        // 当方向为(0,-1,0)时，旋转应该为(0,0,0)
        // 计算俯仰角（pitch）- 绕X轴的旋转
        // 使用atan2来处理所有情况，避免在y=-1时的奇异性
        const pitch = Math.atan2(Math.sqrt(dir.x * dir.x + dir.z * dir.z), -dir.y);
        
        // 计算偏航角（yaw）- 绕Y轴的旋转
        // 当x和z都为0时，使用0作为默认值
        const yaw = (dir.x === 0 && dir.z === 0) ? 0 : Math.atan2(dir.x, dir.z);
        
        // 设置欧拉角（按照 XYZ 顺序）
        this.DynamicVariables.rotation.set(
            pitch,
            yaw,
            0
        );
    }

    /**
     * 根据旋转更新光源方向 (0,-1,0)方向定位初始方向
     */
    #UpdateLightDirection() {
        const rotation = this.DynamicVariables.rotation;
        
        // 从欧拉角计算方向向量
        // 默认方向是 (0, 0, -1)，即沿着 -Z 轴
        const direction = new THREE.Vector3(0, -1, 0);
        
        // 创建旋转矩阵
        const rotationMatrix = new THREE.Matrix4();
        rotationMatrix.makeRotationFromEuler(
            new THREE.Euler(rotation.x, rotation.y, rotation.z, 'XYZ')
        );
        
        // 应用旋转
        direction.applyMatrix4(rotationMatrix);
        
        // 更新光照方向
        this.DynamicVariables.lightDirection.copy(direction);
        this.DynamicVariables.lightDirection.normalize();
    }

    /**
     * 设置光源数据
     * @param {Object} lightData 包含光源相关数据的对象
     * @param {string} uuid GPU端对应的标识符
     */
    SetLightData(lightData, uuid) {
        if (lightData) {
            this.DynamicVariables.color.copy(lightData.color);
            this.DynamicVariables.intensity = lightData.intensity;
            this.DynamicVariables.lightDirection.copy(lightData.lightDirection);
            // 复制其他级联阴影相关参数
            if (lightData.numCascades) {
                this.DynamicVariables.numCascades = lightData.numCascades;
                this.DynamicVariables.cascadeLightBias = new Float32Array(lightData.cascadeLightBias);
                this.DynamicVariables.cascadeNormalBias = new Float32Array(lightData.cascadeNormalBias);
            }
            this.DynamicVariables.splitThreshold = lightData.splitThreshold;
            this.DynamicVariables.size = lightData.size;
            this.DynamicVariables.cascadeNear = lightData.cascadeNear;
            this.DynamicVariables.farMultiplier = lightData.farMultiplier;
            this.DynamicVariables.farOffset = lightData.farOffset;
            this.DynamicVariables.bShowCascade = lightData.bShowCascade;
        }
        this.uuid = uuid;
        this.#UpdateRotation();
    }

    UpdateLight() {
        if(this.GPULight){
            this.GPULight.UpdateParamsFromUI(this);
        }
    }

    GetDetailProperties() {
        const baseProperties = super.GetDetailProperties();
        
        // 创建级联偏移数组的属性
        const cascadeProperties = {};
        for (let i = 0; i < this.DynamicVariables.numCascades; i++) {
            cascadeProperties[`cascadeShadowBias.CascadeLightBias${i}`] = {
                value: this.DynamicVariables.cascadeLightBias[i] / 0.001,
                label: `级联${i}深度偏移 x 0.001`,
                onChange: (path, value) => {
                    this.DynamicVariables.cascadeLightBias[i] = value * 0.001;
                    this.UpdateLight();
                }
            };
            cascadeProperties[`cascadeShadowNormalBias.CascadeNormalBias${i}`] = {
                value: this.DynamicVariables.cascadeNormalBias[i] / 0.001,
                label: `级联${i}法线偏移 x 0.001`,
                onChange: (path, value) => {
                    this.DynamicVariables.cascadeNormalBias[i] = value * 0.001;
                    this.UpdateLight();
                }
            };
        }
        
        return {
            ...baseProperties,
            'Transform.Rotation': {
                value: [
                    this.DynamicVariables.rotation.x * THREE.MathUtils.RAD2DEG/10,
                    this.DynamicVariables.rotation.y * THREE.MathUtils.RAD2DEG/10,
                    this.DynamicVariables.rotation.z * THREE.MathUtils.RAD2DEG/10
                ],
                label: '旋转 x 10 （度）',
                onChange: (path, value) => {
                    this.DynamicVariables.rotation.set(
                        value[0] * THREE.MathUtils.DEG2RAD * 10,
                        value[1] * THREE.MathUtils.DEG2RAD * 10,
                        value[2] * THREE.MathUtils.DEG2RAD * 10
                    );
                    this.#UpdateLightDirection(); // 更新光照方向
                    this.UpdateLight();
                }
            },
            'Light.Color': {
                value: this.DynamicVariables.color.getHexString(),
                label: '颜色',
                onChange: (path, value) => {
                    this.DynamicVariables.color.setHex(parseInt(value, 16));
                    this.UpdateLight();
                }
            },
            'Light.Intensity': {
                value: this.DynamicVariables.intensity,
                label: '强度',
                onChange: (path, value) => {
                    this.DynamicVariables.intensity = value;
                    this.UpdateLight();
                }
            },
            'Shadow.NumCascades': {
                value: this.DynamicVariables.numCascades,
                label: '级联数量',
                onChange: (path, value) => {
                    this.DynamicVariables.numCascades = value;
                    this.UpdateLight();
                }
            },
            'Shadow.SplitThreshold': {
                value: this.DynamicVariables.splitThreshold / 0.00001,
                label: '级联分割阈值 x 0.00001',
                onChange: (path, value) => {
                    this.DynamicVariables.splitThreshold = value * 0.00001;
                    this.UpdateLight();
                }
            },
            'Shadow.Size': {
                value: this.DynamicVariables.size,
                label: '阴影贴图尺寸',
                onChange: (path, value) => {
                    this.DynamicVariables.size = value;
                    this.UpdateLight();
                }
            },
            'Shadow.CascadeNear': {
                value: this.DynamicVariables.cascadeNear,
                label: '级联近平面',
                onChange: (path, value) => {
                    this.DynamicVariables.cascadeNear = value;
                    this.UpdateLight();
                }
            },
            'Shadow.FarMultiplier': {
                value: this.DynamicVariables.farMultiplier,
                label: '远平面倍数',
                onChange: (path, value) => {
                    this.DynamicVariables.farMultiplier = value;
                    this.UpdateLight();
                }
            },
            'Shadow.FarOffset': {
                value: this.DynamicVariables.farOffset,
                label: '远平面偏移',
                onChange: (path, value) => {
                    this.DynamicVariables.farOffset = value;
                    this.UpdateLight();
                }
            },
            'Shadow.ShowCascade': {
                value: this.DynamicVariables.bShowCascade,
                label: '显示级联',
                onChange: (path, value) => {
                    this.DynamicVariables.bShowCascade = value;
                    this.UpdateLight();
                }
            },
            ...cascadeProperties
        };
    }
}

export default DirectionalLight; 