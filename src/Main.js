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
