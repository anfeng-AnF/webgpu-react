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
import DirectionalLight from './Source/Scene/UI/Object/DirectionalLight';
import PointLight from './Source/Scene/UI/Object/PointLight';

class Main {
    static ModuleManager = null;

    static async Initialize() {
        try {
            // 获取模块管理器实例
            Main.ModuleManager = FModuleManager.GetInstance();
            await Main.ModuleManager.Initialize();
/*
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

            // 获取Lights过滤器并添加光源
            const lightsFilter = testScene.Children.get('Lights');

            // 添加方向光
            const mainDirectionalLight = new DirectionalLight('MainDirectionalLight');
            mainDirectionalLight.SetLightData({
                color: new THREE.Color(1, 0.95, 0.8),
                intensity: 1.5,
                castShadow: true,
                rotation: new THREE.Euler(-Math.PI / 4, Math.PI / 4, 0)
            }, 'main_directional_light');
            lightsFilter.AddChild(mainDirectionalLight.Name, mainDirectionalLight);

            // 添加环境补光
            const fillDirectionalLight = new DirectionalLight('FillDirectionalLight');
            fillDirectionalLight.SetLightData({
                color: new THREE.Color(0.6, 0.7, 1),
                intensity: 0.5,
                castShadow: false,
                rotation: new THREE.Euler(-Math.PI / 6, -Math.PI / 4, 0)
            }, 'fill_directional_light');
            lightsFilter.AddChild(fillDirectionalLight.Name, fillDirectionalLight);

            // 添加一些点光源
            const pointLights = [
                {
                    name: 'PointLight_1',
                    data: {
                        color: new THREE.Color(1, 0.8, 0.5),
                        intensity: 2,
                        distance: 10,
                        decay: 2,
                        castShadow: true
                    }
                },
                {
                    name: 'PointLight_2',
                    data: {
                        color: new THREE.Color(0.5, 0.8, 1),
                        intensity: 1.5,
                        distance: 15,
                        decay: 2,
                        castShadow: true
                    }
                }
            ];

            pointLights.forEach((lightInfo, index) => {
                const pointLight = new PointLight(lightInfo.name);
                pointLight.SetLightData(
                    lightInfo.data,
                    `point_light_${index}`
                );
                lightsFilter.AddChild(pointLight.Name, pointLight);
            });

            // 获取 UIModel 模块并更新场景树
            const uiModel = Main.ModuleManager.GetModule('UIModule');
            if (!uiModel) {
                throw new Error('UIModel module not found');
            }

            testScene.Update();
            console.log('Test scene initialized with lights');
            const loader = new BlenderSceneLoaderFbx();
            const scene = await loader.load(
                'Content/Module/Scene/liyue/海灯节广场.fbx', 
                'Content/Module/Scene/liyue/scene_structure.json'
            );
            scene.Update();
            
            console.log('Scene loaded:', scene);
            */

        } catch (Error) {
            console.error('Initialization failed:', Error);
        }
    }
}

export default Main;
