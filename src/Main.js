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

            // 测试 SceneTreeBuilder
            const sceneTreeBuilder = uiModel.SceneTreeBuilder;

            // 添加结构变更回调
            sceneTreeBuilder.setStructureChangeCallback((changeInfo) => {
                console.log('Tree structure changed:', {
                    type: changeInfo.type,
                    node: changeInfo.node.name,
                    fromPath: changeInfo.fromPath,
                    toPath: changeInfo.toPath,
                    position: changeInfo.position,
                    oldParent: changeInfo.oldParent.name,
                    newParent: changeInfo.newParent.name
                });
            });

            // 添加列宽度变化回调
            sceneTreeBuilder.setColumnWidthChangeCallback((width) => {
                console.log('Column width changed:', width);
            });

            // 添加选中项变化回调
            sceneTreeBuilder.setSelectionChangeCallback((selectedPaths) => {
                console.log('Selection changed:', {
                    count: selectedPaths.length,
                    items: selectedPaths.map(path => {
                        const node = sceneTreeBuilder.findNodeByPath(path);
                        return {
                            name: node.name,
                            type: node.type,
                            path: path
                        };
                    })
                });
            });

            // 添加可见性变化回调
            sceneTreeBuilder.setVisibilityChangeCallback((path, visible) => {
                const node = sceneTreeBuilder.findNodeByPath(path);
                console.log('Visibility changed:', {
                    name: node.name,
                    type: node.type,
                    path: path,
                    visible: visible
                });
            });

            // 设置测试数据
            sceneTreeBuilder.setTreeData({
                name: 'DragonRuins',
                type: '编辑器',
                expanded: true,
                children: [
                    {
                        name: 'Actors',
                        type: '文件夹',
                        expanded: true,
                        children: [
                            {
                                name: 'Scenes',
                                type: '文件夹',
                                expanded: true,
                                children: [
                                    {
                                        name: 'BaseScene',
                                        type: '文件夹',
                                        expanded: true,
                                        children: [
                                            {
                                                name: 'Grass01',
                                                type: 'StaticMeshActor'
                                            },
                                            {
                                                name: 'ruins01',
                                                type: 'StaticMeshActor'
                                            },
                                            {
                                                name: 'ruins03_竜遺者の旅跡_mesh_007',
                                                type: 'StaticMeshActor'
                                            },
                                            {
                                                name: 'ruins04',
                                                type: 'StaticMeshActor'
                                            },
                                            {
                                                name: 'terrainRef_竜遺者の旅跡_mesh_003',
                                                type: 'StaticMeshActor'
                                            },
                                            {
                                                name: 'VirtualHeightfieldMesh',
                                                type: 'VirtualHeightfieldMesh'
                                            },
                                            {
                                                name: 'Water',
                                                type: 'StaticMeshActor'
                                            },
                                            {
                                                name: '运行时虚拟纹理体积',
                                                type: 'RuntimeVirtualTextureVolume'
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        name: 'Rocks',
                        type: '文件夹'
                    },
                    {
                        name: 'Terrain',
                        type: '文件夹'
                    },
                    {
                        name: 'Atmosphere',
                        type: '文件夹'
                    },
                    {
                        name: 'Lights',
                        type: '文件夹'
                    }
                ]
            });

            console.log('Scene tree initialized');

        } catch (Error) {
            console.error('Initialization failed:', Error);
        }
    }
}

export default Main;
