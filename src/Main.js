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
import Scene from './Source/Scene/UI/Scene';
import Filter from './Source/Scene/UI/Object/Filter';
import SceneStaticMesh from './Source/Scene/UI/Object/SceneStaticMesh';

class Main {
    static ModuleManager = null;

    static async Initialize() {
        try {
            // 获取模块管理器实例
            Main.ModuleManager = FModuleManager.GetInstance();
            await Main.ModuleManager.Initialize();

            // 创建测试场景
            const testScene = new Scene();
            testScene.Name = "TestScene";

            // 创建 Actors 过滤器
            const actorsFilter = new Filter("Actors");
            testScene.AddChild(actorsFilter.Name, actorsFilter);

            // 创建 Scenes 过滤器作为 Actors 的子节点
            const scenesFilter = new Filter("Scenes");
            actorsFilter.AddChild(scenesFilter.Name, scenesFilter);

            // 创建 BaseScene 过滤器作为 Scenes 的子节点
            const baseSceneFilter = new Filter("BaseScene");
            scenesFilter.AddChild(baseSceneFilter.Name, baseSceneFilter);

            // 添加一些静态网格到 BaseScene
            const staticMeshes = [
                "Grass01",
                "ruins01",
                "ruins03_竜遺者の旅跡_mesh_007",
                "ruins04",
                "terrainRef_竜遺者の旅跡_mesh_003",
                "Water"
            ];

            staticMeshes.forEach(meshName => {
                const mesh = new SceneStaticMesh(meshName);
                baseSceneFilter.AddChild(mesh.Name, mesh);
            });

            // 创建其他顶级过滤器
            const topLevelFilters = [
                "Rocks",
                "Terrain",
                "Atmosphere",
                "Lights"
            ];

            topLevelFilters.forEach(filterName => {
                const filter = new Filter(filterName);
                testScene.AddChild(filter.Name, filter);
            });

            // 获取 UIModel 模块
            const uiModel = Main.ModuleManager.GetModule('UIModule');
            if (!uiModel) {
                throw new Error('UIModel module not found');
            }

            // 测试 SceneTreeBuilder
            const sceneTreeBuilder = uiModel.SceneTreeBuilder;

            // 将测试场景数据转换为UI树并设置
            sceneTreeBuilder.setTreeData(testScene.toUITree());

            console.log('Test scene initialized');

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
