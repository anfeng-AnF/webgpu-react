import React from 'react';
import './App.css';
import UIModel from './Source/UI/UIModel';
import DetailBuilder from './Source/UI/Components/Details/DetailBuilder';

/**
 * 应用程序根组件
 */
class App extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            // 基本信息
            actorGuid: "F7977D324F1DA9A205CDF3A430F87F7E",
            inSelection: "在该关卡中1个已选中",
            
            // 变换
            transform: {
                position: [2236.0, -1440.0, 283.070386],
                rotation: [0.0, 0.0, 0.0],
                scale: [1.0725, 1.0725, 1.0725],
                mobility: {
                    position: [0, 0, 0],
                    rotation: [0, 0, 0]
                }
            },

            // 静态网格体
            staticMesh: {
                mesh: "Cube",
                materials: ["BasicShapeMaterial"],
                mobility: "Static"
            },
            
            // 物理
            physics: {
                simulatePhysics: false,
                mass: 208.158386,
                linearDamping: 0.01,
                angularDamping: 0.0,
                enableGravity: true,
            },
            
            // 碰撞
            collision: {
                enabled: true,
                type: "QueryAndPhysics",
                complexity: "Simple",
            },
            
            // 渲染
            rendering: {
                castShadow: true,
                receiveShadow: true,
                hiddenInGame: false,
                customDepth: {
                    enabled: false,
                    value: 0
                }
            }
        };
        this.detailBuilder = new DetailBuilder(this.handleStateChange);
    }

    handleStateChange = (path, value) => {
        const pathParts = path.split('.');
        const key = pathParts.pop();
        const section = pathParts.join('.');

        this.setState(prevState => {
            let newState = { ...prevState };
            if (section) {
                let target = newState;
                const parts = section.split('.');
                for (const part of parts) {
                    target = target[part] = { ...target[part] };
                }
                target[key] = value;
            } else {
                newState[key] = value;
            }

            // 更新DetailBuilder中的值
            this.detailBuilder.updateProperty(path, value);

            return newState;
        }, () => {
            // 状态更新后强制重新渲染
            this.forceUpdate();
        });
    };

    // 添加一个方法来更新所有属性
    updateAllProperties() {
        Object.entries(this.state).forEach(([key, value]) => {
            if (typeof value === 'object' && value !== null) {
                this.updateObjectProperties(key, value);
            } else {
                this.detailBuilder.updateProperty(key, value);
            }
        });
    }

    // 递归更新嵌套对象的属性
    updateObjectProperties(prefix, obj) {
        Object.entries(obj).forEach(([key, value]) => {
            const path = `${prefix}.${key}`;
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                this.updateObjectProperties(path, value);
            } else {
                this.detailBuilder.updateProperty(path, value);
            }
        });
    }

    componentDidMount() {
        // 使用新的批量添加方法
        this.detailBuilder.addProperties({
            // 基本信息
            'actorGuid': {
                value: this.state.actorGuid,
                label: 'Actor GUID'
            },
            'inSelection': {
                value: this.state.inSelection,
                label: '选中状态'
            },

            // 变换
            'transform.position': {
                value: this.state.transform.position,
                label: '位置'
            },
            'transform.rotation': {
                value: this.state.transform.rotation,
                label: '旋转'
            },
            'transform.scale': {
                value: this.state.transform.scale,
                label: '缩放'
            },

            // 移动性
            'transform.mobility.position': {
                value: this.state.transform.mobility.position,
                label: '位置偏移'
            },
            'transform.mobility.rotation': {
                value: this.state.transform.mobility.rotation,
                label: '旋转偏移'
            },

            // 静态网格体
            'staticMesh.mesh': {
                value: this.state.staticMesh.mesh,
                label: '静态网格体',
                options: [
                    { value: 'Cube', label: 'Cube' },
                    { value: 'Sphere', label: 'Sphere' },
                    { value: 'Cylinder', label: 'Cylinder' }
                ]
            },
            'staticMesh.mobility': {
                value: this.state.staticMesh.mobility,
                label: '移动性',
                options: [
                    { value: 'Static', label: '静态' },
                    { value: 'Stationary', label: '固定' },
                    { value: 'Movable', label: '可移动' }
                ]
            },

            // 物理
            'physics.simulatePhysics': {
                value: this.state.physics.simulatePhysics,
                label: '模拟物理'
            },
            'physics.mass': {
                value: this.state.physics.mass,
                label: '质量（公斤）'
            },
            // ... 其他属性配置
        });

        // 或者使用辅助方法从state生成配置
        // const properties = DetailBuilder.createPropertiesFromObject(this.state);
        // this.detailBuilder.addProperties(properties);

        // 更新所有属性值
        this.updateAllProperties();
        this.forceUpdate();
    }

    render() {
        return (
            <div className="app">
                <UIModel>
                    {this.detailBuilder.build()}
                </UIModel>
            </div>
        );
    }
}

export default App;
