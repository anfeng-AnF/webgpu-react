/* global GPUTextureUsage, GPUBufferUsage */
import FModuleManager from './Source/Core/FModuleManager';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createPBRMaterial } from './Source/Material/Mat_Instance/PBR.js';
import FResourceManager from './Source/Core/Resource/FResourceManager.js';
import GPUScene from './Source/Scene/GPUScene.js';
import StaticMesh from './Source/Object3D/Mesh/StaticMesh.js';

class Main {
    static ModuleManager = null;

    static async Initialize() {
        try {
            // 获取模块管理器实例
            Main.ModuleManager = FModuleManager.GetInstance();
            await Main.ModuleManager.Initialize();

            // 获取 UIModel 模块
            const uiModel = Main.ModuleManager.GetModule('UIModule');
            if (!uiModel) {
                throw new Error('UIModel module not found');
            }

            // 测试 WorldSettingsBuilder
            const worldSettingsBuilder = uiModel.WorldSettingsBuilder;

            // 添加一些测试设置
            const worldSettings = {
                'Environment.SkyLight': {
                    value: true,
                    label: '天空光',
                    onChange: (path, value) => {
                        console.log('天空光已更改:', value);
                    }
                },
                'Environment.Lighting': {
                    value: 'Dynamic',
                    label: '光照模式',
                    type: 'enum',
                    options: [
                        { value: 'Static', label: '静态光照' },
                        { value: 'Dynamic', label: '动态光照' },
                        { value: 'Baked', label: '烘焙光照' }
                    ],
                    onChange: (path, value) => {
                        console.log('光照模式已更改:', value);
                    }
                },
                'Environment.AmbientLight': {
                    value: [0.2, 0.2, 0.2],
                    label: '环境光颜色',
                    onChange: (path, value) => {
                        console.log('环境光颜色已更改:', value);
                    }
                },
                'Physics.Gravity': {
                    value: -9.81,
                    label: '重力',
                    onChange: (path, value) => {
                        console.log('重力已更改:', value);
                    }
                },
                'Physics.EnablePhysics': {
                    value: true,
                    label: '启用物理',
                    onChange: (path, value) => {
                        console.log('物理系统状态已更改:', value);
                    }
                },
                'Rendering.ShadowQuality': {
                    value: 'High',
                    label: '阴影质量',
                    type: 'enum',
                    options: [
                        { value: 'Low', label: '低' },
                        { value: 'Medium', label: '中' },
                        { value: 'High', label: '高' }
                    ],
                    onChange: (path, value) => {
                        console.log('阴影质量已更改:', value);
                    }
                },
                'Rendering.AntiAliasing': {
                    value: true,
                    label: '抗锯齿',
                    onChange: (path, value) => {
                        console.log('抗锯齿状态已更改:', value);
                    }
                },
                'Rendering.PostProcessing': {
                    value: true,
                    label: '后处理',
                    onChange: (path, value) => {
                        console.log('后处理状态已更改:', value);
                    }
                },
                'Navigation.AutoGenerate': {
                    value: true,
                    label: '自动生成导航网格',
                    onChange: (path, value) => {
                        console.log('自动生成导航网格状态已更改:', value);
                    }
                },
                'Navigation.AgentHeight': {
                    value: 2.0,
                    label: '代理高度',
                    onChange: (path, value) => {
                        console.log('代理高度已更改:', value);
                    }
                },
                'Navigation.AgentRadius': {
                    value: 0.5,
                    label: '代理半径',
                    onChange: (path, value) => {
                        console.log('代理半径已更改:', value);
                    }
                }
            };

            // 使用 addProperties 而不是 addProperty
            worldSettingsBuilder.addProperties(worldSettings);

            console.log('World settings initialized');

            // 3秒后移除抗锯齿选项
            setTimeout(() => {
                const path = 'Rendering.AntiAliasing';
                worldSettingsBuilder.properties.delete(path);
                if (worldSettingsBuilder.sections.has('Rendering')) {
                    worldSettingsBuilder.sections.get('Rendering').delete(path);
                }
                console.log('抗锯齿选项已移除');
                
                // 触发重新渲染
                uiModel.Update(0);

                // 2秒后重新添加抗锯齿选项
                setTimeout(() => {
                    worldSettingsBuilder.addProperty('Rendering.AntiAliasing', false, {
                        label: '抗锯齿',
                        onChange: (path, value) => {
                            console.log('新添加的抗锯齿状态已更改:', value);
                        }
                    });
                    console.log('抗锯齿选项已重新添加');
                    
                    // 触发重新渲染
                    uiModel.Update(0);
                }, 2000);

            }, 3000);

        } catch (Error) {
            console.error('Initialization failed:', Error);
        }
    }
}

export default Main;
