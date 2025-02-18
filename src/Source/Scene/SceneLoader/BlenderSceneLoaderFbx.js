import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import StaticMesh from '../../Object3D/Mesh/StaticMesh';
import GPUScene from '../GPUScene.js';
class BlenderSceneLoaderFbx {
    constructor() {
        this.fbxLoader = new FBXLoader();
        this.objectMap = new Map(); // Store <name, object3D> mapping
    }

    /**
     * Load scene from FBX and structure JSON
     * @param {string} fbxPath - Path to FBX file
     * @param {string} jsonPath - Path to scene structure JSON
     * @returns {Promise<THREE.Scene>}
     */
    async load(fbxPath, jsonPath) {
        try {
            // Load FBX and JSON in parallel
            const [fbxScene, sceneStructure] = await Promise.all([
                this.loadFbx(fbxPath),
                this.loadJson(jsonPath),
            ]);

            console.log(fbxScene);
            // Map all objects from FBX by name
            this.mapObjects(fbxScene);

            // Create new scene
            const scene = new THREE.Scene();

            // Build scene hierarchy according to JSON structure
            this.buildSceneHierarchy(sceneStructure, scene);

            return scene;
        } catch (error) {
            console.error('Failed to load scene:', error);
            throw error;
        }
    }

    async loadGPUScene(fbxPath, jsonPath) {
        // Load FBX and JSON in parallel
        const [fbxScene, sceneStructure] = await Promise.all([
            this.loadFbx(fbxPath),
            this.loadJson(jsonPath),
        ]);

        console.log(fbxScene);
        // Map all objects from FBX by name
        this.mapObjects(fbxScene);

        // Create new scene
        const scene = new THREE.Scene();

        // Build scene hierarchy according to JSON structure
        this.buildGPUSceneHierarchy(sceneStructure, scene);

        // 现在完成对scene的初始化，然后将其转为GPUScene
        const gpuScene = new GPUScene();
        gpuScene.children = scene.children;

        

        return gpuScene;
    }

    /**
     * Load FBX file
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
     * Load JSON file
     * @private
     */
    async loadJson(jsonPath) {
        const response = await fetch(jsonPath);
        return response.json();
    }

    /**
     * Map all objects from FBX scene by their names
     * @private
     */
    mapObjects(fbxScene) {
        fbxScene.traverse((object) => {
            if (object.name) {
                this.objectMap.set(object.name, object);
            }
        });
    }

    /**
     * Recursively build scene hierarchy based on JSON structure
     * @private
     */
    buildSceneHierarchy(structureNode, parentObject) {
        for (const [name, node] of Object.entries(structureNode)) {
            if (name === 'type') continue;

            let object;
            if (node.type === 'COLLECTION') {
                // Create a new group for collections
                object = new THREE.Group();
                object.name = name;
                this.buildSceneHierarchy(node, object);
            } else {
                // Get the object from our map
                object = this.objectMap.get(name);
                if (!object) {
                    console.warn(`Object "${name}" not found in FBX scene`);
                    continue;
                }

                // Clone the object if it's already been used
                if (object.parent) {
                    object = object.clone();
                    object.name = name;
                }
            }

            if (object) {
                parentObject.add(object);
            }
        }
    }

    buildGPUSceneHierarchy(structureNode, parentObject) {
        for (const [name, node] of Object.entries(structureNode)) {
            if (name === 'type') continue;

            let object;
            if (node.type === 'COLLECTION') {
                // Create a new group for collections
                object = new THREE.Group();
                object.name = name;
                this.buildSceneHierarchy(node, object);
            } else {
                // Get the object from our map
                object = this.objectMap.get(name);
                if (!object) {
                    console.warn(`Object "${name}" not found in FBX scene`);
                    continue;
                }

                // Clone the object if it's already been used
                if (object.parent) {
                    object = object.clone();
                    object.name = name;
                }

                // 尝试转为GPU对象
                object = this.tryConvertToGPUObject(object) || object;
            }

            if (object) {
                parentObject.add(object);
            }
        }
    }

    /**
     * 尝试将对象转为GPU对象
     * @param {THREE.Object3D} object 
     * @returns {StaticMesh|null}
     */
    tryConvertToGPUObject(object) {
        let returnObject = null;
        if (object instanceof THREE.Mesh) {
            returnObject = new StaticMesh(object);
        }



        // clone属性
        if (returnObject) {
            returnObject.uuid = object.uuid;
            returnObject.name = object.name;
            returnObject.position = object.position;
            returnObject.rotation = object.rotation;
            returnObject.scale = object.scale;
        }
        return returnObject;
    }
}

export default BlenderSceneLoaderFbx;
