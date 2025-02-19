import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';

// 导入自定义 Scene 及子对象
import Scene from '../UI/Scene.js';
import Filter from '../UI/Object/Filter.js';
import SceneStaticMesh from '../UI/Object/SceneStaticMesh.js';
import DirectionalLight from '../UI/Object/DirectionalLight.js';
import PointLight from '../UI/Object/PointLight.js';
import Object3D from '../UI/Object/Object3D.js';

class BlenderSceneLoaderFbx {
    constructor() {
        this.fbxLoader = new FBXLoader();
        this.objectMap = new Map(); // 用于存储 <名称, Object3D> 映射
    }

    /**
     * 加载 FBX 与场景结构 JSON，并构建自定义 Scene 层级结构
     * @param {string} fbxPath - FBX 文件路径
     * @param {string} jsonPath - 场景结构 JSON 文件路径
     * @returns {Promise<Scene>} 返回自定义 Scene 对象
     */
    async load(fbxPath, jsonPath) {
        try {
            // 并行加载 FBX 与 JSON
            const [fbxScene, sceneStructure] = await Promise.all([
                this.loadFbx(fbxPath),
                this.loadJson(jsonPath)
            ]);

            console.log(fbxScene);
            // 遍历 FBX 场景，将对象以名称为键存入映射，同时去掉名称中的点号（".")
            this.mapObjects(fbxScene);

            // 创建自定义 Scene（而非 THREE.Scene）
            const scene = new Scene();

            // 根据 JSON 结构递归构建层级结构，并添加到自定义 Scene 中
            this.buildSceneHierarchy(sceneStructure, scene);

            return scene;
        } catch (error) {
            console.error('加载场景失败:', error);
            throw error;
        }
    }

    /**
     * 加载 FBX 文件
     * @private
     */
    loadFbx(fbxPath) {
        return new Promise((resolve, reject) => {
            this.fbxLoader.load(
                fbxPath,
                (object) => resolve(object),
                undefined,
                (error) => reject(error)
            );
        });
    }

    /**
     * 加载 JSON 文件
     * @private
     */
    async loadJson(jsonPath) {
        const response = await fetch(jsonPath);
        return response.json();
    }

    /**
     * 遍历 FBX 场景，将所有对象以名称（去除点号）存入映射
     * @private
     */
    mapObjects(fbxScene) {
        fbxScene.traverse((object) => {
            if (object.name) {
                // 使用正则将所有的 "." 替换掉，以匹配 Blender 导出后的名称格式
                const cleanedName = object.name.replace(/\./g, '');
                this.objectMap.set(cleanedName, object);
            }
        });
    }

    /**
     * 根据 JSON 结构递归构建自定义 Scene 层级结构
     * 并根据节点类型对 FBX 对象进行包装转换。
     * @private
     * @param {Object} structureNode - JSON 层级结构节点
     * @param {IObjectBase} parentObject - 自定义 Scene 中的父节点
     */
    buildSceneHierarchy(structureNode, parentObject) {
        for (const [name, node] of Object.entries(structureNode)) {
            if (name === 'type') continue;  // 忽略类型字段

            let customNode = null;
            if (node.type === 'COLLECTION') {
                // 集合节点使用 Filter 表示
                customNode = new Filter(name);
                // 递归构建子层级
                this.buildSceneHierarchy(node, customNode);
            } else {
                // 其他节点，从映射中查找对应的 FBX 对象
                const fbxObject = this.objectMap.get(name);
                if (!fbxObject) {
                    console.warn(`FBX 场景中未找到对象 "${name}"`);
                    continue;
                }
                // 将 FBX 对象封装为自定义场景节点
                customNode = this.convertFBXObjectToCustomNode(name, fbxObject);
            }

            if (customNode) {
                // 使用自定义 Scene 的 AddChild 方法构建层级
                if (parentObject.AddChild) {
                    parentObject.AddChild(name, customNode);
                } else {
                    console.warn('父对象不支持 AddChild 方法');
                }
            }
        }
    }

    /**
     * 将一个 FBX 对象转换为自定义场景节点（IObjectBase 的子类）
     * 根据 FBX 对象类型选择对应的包装类：
     * - Mesh 对象 -> SceneStaticMesh
     * - DirectionalLight -> DirectionalLight
     * - PointLight -> PointLight
     * - 其他则使用通用的 Object3D 包装
     * @private
     * @param {string} name - 对象名称
     * @param {THREE.Object3D} fbxObject - FBX 场景中的对象
     * @returns {IObjectBase} 自定义包装后的场景节点
     */
    convertFBXObjectToCustomNode(name, fbxObject) {
        let customNode = null;
        if (fbxObject.isMesh) {
            // 对于网格，创建静态网格节点
            customNode = new SceneStaticMesh(name);
            customNode.Mesh = fbxObject;
            customNode.Position.copy(fbxObject.position);
            customNode.Rotation.copy(fbxObject.rotation);
            customNode.Scale.copy(fbxObject.scale);
        } else if (fbxObject.isLight) {
            if (fbxObject instanceof THREE.DirectionalLight) {
                customNode = new DirectionalLight(name);
                customNode.DynamicVariables.Color.copy(fbxObject.color);
                customNode.DynamicVariables.Intensity = fbxObject.intensity;
                customNode.Rotation.copy(fbxObject.rotation);
            } else if (fbxObject instanceof THREE.PointLight) {
                customNode = new PointLight(name);
                customNode.DynamicVariables.Color.copy(fbxObject.color);
                customNode.DynamicVariables.Intensity = fbxObject.intensity;
                customNode.DynamicVariables.Distance = fbxObject.distance;
                customNode.DynamicVariables.Decay = fbxObject.decay;
            } else {
                // 非 Directional 或 Point 类型的光源，暂使用通用包装
                customNode = new Object3D();
                customNode.Name = name;
            }
        } else {
            // 针对其他类型对象，使用 Object3D 包装，并复制变换数据
            customNode = new Object3D();
            customNode.Name = name;
            customNode.DynamicVariables.WorldPosition.copy(fbxObject.position);
            customNode.DynamicVariables.WorldRotation.copy(fbxObject.rotation);
            customNode.DynamicVariables.WorldScale.copy(fbxObject.scale);
        }
        return customNode;
    }
}

export default BlenderSceneLoaderFbx;
