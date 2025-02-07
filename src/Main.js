/* global GPUTextureUsage, GPUBufferUsage */
import FModuleManager from './Source/Core/FModuleManager';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createPBRMaterial } from './Source/Material/Mat_Instance/PBR.js';
import FResourceManager from './Source/Core/Resource/FResourceManager.js';
import GPUScene from './Source/Scene/GPUScene.js';
import StaticMesh from './Source/Mesh/StaticMesh.js';

class Main {
    static ModuleManager = null;

    static async Initialize() {
        try {
            // 获取模块管理器实例
            Main.ModuleManager = FModuleManager.GetInstance();
            await Main.ModuleManager.Initialize();

            // 假设资源管理器实例由 ModuleManager 暴露，调整属性名称以符合项目实际情况
            const resourceManager = FResourceManager.GetInstance();

            // 调用PBR材质模块测试创建 PBR 材质，传入 null 表示使用占位资源
            const pbrMaterial = await createPBRMaterial(
                resourceManager,
                /* BaseColorTexture */ null,
                /* NormalTexture */ null,
                /* MetallicTexture */ null,
                /* RoughnessTexture */ null,
                /* SpecularTexture */ null,
                /* BaseColorSampler */ null,
                /* NormalSampler */ null,
                /* MetallicSampler */ null,
                /* RoughnessSampler */ null,
                /* SpecularSampler */ null
            );
            console.log("PBR Material created: ", pbrMaterial);
            console.log("PBR Material Info: ", pbrMaterial.getMaterialInfo());

            // 将 StaticMesh 默认材质设置为 PBR 材质，确保 GPUScene 包裹的 Mesh 使用正确的材质
            StaticMesh.DefaultMaterial = pbrMaterial;

            // -----------------------------
            // 以下测试 GPUScene 功能
            // -----------------------------
            // 创建 GPUScene 实例（device 可从 resourceManager.GetDevice() 获取）
            const gpuScene = new GPUScene(resourceManager);
            // 初始化 GPUScene 缓冲区（例如最多管理 10 个 Mesh）
            await gpuScene.initBuffers(10);

            // 创建一个透视摄像机并赋值给 GPUScene
            const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            camera.position.set(0, 0, 5);
            camera.lookAt(new THREE.Vector3(0, 0, 0));
            gpuScene.camera = camera;

            // 调用 updateSceneBuffer 模拟更新场景数据（使用 DeltaTime = 0.016s）
            gpuScene.updateSceneBuffer(0.016);
            console.log("SceneBuffer has been updated.");

            // 创建一个测试 Mesh（此处使用 BoxGeometry 和 MeshBasicMaterial）
            const geometry = new THREE.BoxGeometry(1, 1, 1);
            const basicMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
            const cube = new THREE.Mesh(geometry, basicMaterial);
            // 添加 Mesh 到 GPUScene 内部管理（会自动包裹成 StaticMesh，并分配存储槽）
            gpuScene.add(cube);
            console.log("Cube has been added to GPUScene.");
            // 更新该 Mesh 的 MeshInfo 数据，使用 cube.uuid 作为标识
            await gpuScene.updateMeshInfo(cube.uuid);
            console.log("MeshInfo updated for cube1.");

            // -----------------------------
            // 新增测试：移除一个 Mesh 并检测槽复用
            console.log("Removing cube from GPUScene...");
            gpuScene.remove(cube);
            console.log("Removed cube. Current Mesh Count:", gpuScene.currentMeshCount);
            
            // 添加一个新的 Mesh 后，更新 MeshInfo，验证移除后的槽可以复用
            const geometry2 = new THREE.BoxGeometry(1, 1, 1);
            const basicMaterial2 = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
            const cube2 = new THREE.Mesh(geometry2, basicMaterial2);
            gpuScene.add(cube2);
            await gpuScene.updateMeshInfo(cube2.uuid);
            console.log("MeshInfo updated for cube2.");

            // -----------------------------
            // 新增测试：添加 5 个 Mesh
            console.log("=== 新增测试：添加 5 个 Mesh ===");
            const loopMeshes = [];
            for (let i = 1; i <= 5; i++) {
                const geometryTest = new THREE.BoxGeometry(1, 1, 1);
                // 使用不同颜色以便区分
                const basicMaterialTest = new THREE.MeshBasicMaterial({ color: 0xff0000 + i * 0x001111 });
                const meshTest = new THREE.Mesh(geometryTest, basicMaterialTest);
                gpuScene.add(meshTest);
                await gpuScene.updateMeshInfo(meshTest.uuid);
                console.log(`MeshInfo updated for mesh${i}.`);
                loopMeshes.push(meshTest);
            }

            // 删除第二个 Mesh（即 loopMeshes[1]）
            console.log("=== 删除 'mesh2' ===");
            gpuScene.remove(loopMeshes[1]);
            console.log("Removed mesh2. Current Mesh Count:", gpuScene.currentMeshCount);

            // 再添加 3 个 Mesh
            console.log("=== 再添加 3 个 Mesh ===");
            for (let i = 6; i <= 8; i++) {
                const geometryTest = new THREE.BoxGeometry(1, 1, 1);
                const basicMaterialTest = new THREE.MeshBasicMaterial({ color: 0x00ff00 + i * 0x001111 });
                const meshTest = new THREE.Mesh(geometryTest, basicMaterialTest);
                gpuScene.add(meshTest);
                await gpuScene.updateMeshInfo(meshTest.uuid);
                console.log(`MeshInfo updated for mesh${i}.`);
            }

            // -----------------------------
            // 新增测试：批量更新并读取 MeshStorageBuffer 内容以验证数据
            console.log("=== 新增测试：批量更新并读取 MeshStorageBuffer ===");
            await gpuScene.updateAllMeshInfo();

            // 从 resourceManager 获取 device
            const device = await resourceManager.GetDevice();
            if (!device) {
                console.error("Device is not available in resourceManager for reading buffer.");
            } else {
                const bufferSize = gpuScene.meshStorageBuffer.size;
                // 创建一个用于读取的临时 Buffer，需使用 MAP_READ 权限
                const readBuffer = device.createBuffer({
                    size: bufferSize,
                    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
                });

                const commandEncoder = device.createCommandEncoder();
                commandEncoder.copyBufferToBuffer(
                    gpuScene.meshStorageBuffer, 0,
                    readBuffer, 0,
                    bufferSize
                );
                const commands = commandEncoder.finish();
                device.queue.submit([commands]);

                // 等待映射读取完成
                await readBuffer.mapAsync(GPUMapMode.READ);
                const arrayBuffer = readBuffer.getMappedRange();
                const data = new Float32Array(arrayBuffer.slice(0));
                console.log("Contents of MeshStorageBuffer:", data);
                readBuffer.unmap();
            }

            // -----------------------------
            // 新增测试：检查 SceneBuffer 内容
            console.log("=== 新增测试：检查 SceneBuffer 内容 ===");
            const sceneBufferSize = gpuScene.sceneBuffer.size;
            const readSceneBuffer = device.createBuffer({
                size: sceneBufferSize,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
            });

            const commandEncoder2 = device.createCommandEncoder();
            commandEncoder2.copyBufferToBuffer(
                gpuScene.sceneBuffer, 0,
                readSceneBuffer, 0,
                sceneBufferSize
            );
            const commands2 = commandEncoder2.finish();
            device.queue.submit([commands2]);

            // 等待映射读取完成
            await readSceneBuffer.mapAsync(GPUMapMode.READ);
            const sceneArrayBuffer = readSceneBuffer.getMappedRange();
            const sceneData = new Float32Array(sceneArrayBuffer.slice(0));
            console.log("Contents of SceneBuffer:", sceneData);
            readSceneBuffer.unmap();

            // -----------------------------
            // 新增测试：上传 Mesh 的 Buffer 到 GPU 的功能测试
            console.log("=== 新增测试：上传 Mesh 的 Buffer 到 GPU ===");
            gpuScene.upLoadMeshToGPU();
            console.log("All Mesh buffers have been uploaded to GPU.");
        } catch (Error) {
            console.error('Initialization failed:', Error);
        }
    }
}

export default Main;
