/* global GPUTextureUsage, GPUBufferUsage */
import FModuleManager from './Source/Core/FModuleManager';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createPBRMaterial } from './Source/Material/Mat_Instance/PBR.js';
import FResourceManager from './Source/Core/Resource/FResourceManager.js';
import GPUScene from './Source/Scene/GPUScene.js';
import StaticMesh from './Source/Object3D/Mesh/StaticMesh.js';
import BlenderSceneLoaderFbx from './Source/Scene/SceneLoader/BlenderSceneLoaderFbx.js';


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

            // 测试 DetailBuilder 的属性操作
            const detailBuilder = uiModel.DetailBuilder;
            
            // 添加一些初始属性
            detailBuilder.addProperties({
                'Transform.Position': {
                    value: [0, 0, 0],
                    label: '位置',
                    type: 'vector3'
                },
                'Transform.Rotation': {
                    value: [0, 0, 0],
                    label: '旋转',
                    type: 'vector3'
                },
                'Material.Color': {
                    value: 'Red',
                    label: '颜色',
                    type: 'enum',
                    options: [
                        { value: 'Red', label: '红色' },
                        { value: 'Green', label: '绿色' },
                        { value: 'Blue', label: '蓝色' }
                    ]
                }
            });

            console.log('Initial properties added');

            // 测试移除不存在的属性
            console.log('Testing removal of non-existent property...');
            detailBuilder.removeProperty('Transform.Scale'); // 这个属性不存在

            // 测试添加已存在的属性
            console.log('Testing adding existing property...');
            detailBuilder.addProperty('Transform.Position', [20, 20, 20], {
                label: '位置',
                type: 'vector3'
            });

            // 原有的测试代码
            setTimeout(() => {
                console.log('Removing Position property...');
                detailBuilder.removeProperty('Transform.Position');
            }, 3000);

            setTimeout(() => {
                console.log('Re-adding Position property...');
                detailBuilder.addProperty('Transform.Position', [10, 10, 10], {
                    label: '位置',
                    type: 'vector3'
                });
            }, 6000);

            // 再次测试添加已存在的属性
            setTimeout(() => {
                console.log('Testing adding existing property again...');
                detailBuilder.addProperty('Transform.Position', [30, 30, 30], {
                    label: '位置',
                    type: 'vector3'
                });
            }, 9000);

            const loader = new BlenderSceneLoaderFbx();
            const scene = await loader.load(
                'Content/Module/Scene/liyue/海灯节广场.fbx', 
                'Content/Module/Scene/liyue/scene_structure.json'
            );

            console.log('Scene loaded:', scene);

        } catch (Error) {
            console.error('Initialization failed:', Error);
        }
    }
}

export default Main;
