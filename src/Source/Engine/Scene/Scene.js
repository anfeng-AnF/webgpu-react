import FStaticMesh from "../../Mesh/StaticMesh";
import * as THREE from "three"
import FResourceManager from "../../Core/Resource/FResourceManager";

/**
 * 场景类，继承自THREE.Scene
 * 扩展了对GPU资源的管理功能
 * 管理Scenebuffer
 */
class FScene extends THREE.Scene{
    /**
     * GPU网格资源映射表
     * @type {Map<string, FStaticMesh>}
     * @private
     */
    _gpuMeshes = new Map();

    /**
     * 跟踪Scene的场景变换，用于Pass的动态调整
     * @type {number}
     */
    verson = 0;

    /**
     * 主相机
     * @type {THREE.PerspectiveCamera}
     */
    MainCamera = null;

    /**
     * 场景buffer
     * @type {GPUBindGroup}
     */
    SceneBufferBindGroup = null;

    /**
     * Scene Buffer名称
     * @type {string}
     */
    SceneBufferName = 'SceneBuffer';

    /**
     * Scene Buffer Layout名称
     * @type {string}
     */
    SceneBufferLayoutName = 'SceneBufferLayout';

    constructor() {
        super();
        this._ResourceManager = FResourceManager.GetInstance();
        this.time=0;
    }

    /**
     * 添加物体到场景
     * @param {THREE.Object3D} object 
     */
    async add(object) {
        super.add(object);

        // 如果是网格，创建 GPU 资源
        if (object instanceof THREE.Mesh) {
            // 确保网格有唯一ID
            if (!object.ID) {
                object.ID = `mesh_${this.children.length}`;
            }

            // 创建静态网格资源
            const staticMesh = await FStaticMesh.Create(object);
            this._gpuMeshes.set(object.ID, {
                originalMesh: object,
                VertexBufferName: staticMesh.VertexBufferName,
                IndexBufferName: staticMesh.IndexBufferName,
                VertexCount: staticMesh.VertexCount,
                IndexCount: staticMesh.IndexCount,
                bIndexedMesh: staticMesh.bIndexedMesh
            });

            // 更新版本号以触发资源更新
            this.verson++;
        }
    }

    /**
     * 获取网格对应的GPU资源
     * @param {string|THREE.Mesh} meshOrId - 网格对象或其ID
     * @returns {{originalMesh: THREE.Mesh|null, gpuMesh: FStaticMesh|null}} 返回原始网格和GPU网格的对象
     */
    GetGpuMesh(meshOrId) {
        const id = typeof meshOrId === 'string' ? meshOrId : meshOrId.id;
        const originalMesh = this.getObjectById(id);
        const gpuMesh = this._gpuMeshes.get(id);

        return {
            originalMesh,
            gpuMesh
        };
    }

    /**
     * 从场景中移除网格
     * @param {THREE.Mesh} mesh - 要移除的网格对象
     * @returns {THREE.Mesh} 返回被移除的网格对象
     */
    RemoveMesh(mesh) {
        // 从THREE场景中移除
        super.remove(mesh);

        // 从GPU资源映射表中移除
        if (mesh.id && this._gpuMeshes.has(mesh.id)) {
            this._gpuMeshes.delete(mesh.id);
        }

        // 场景发生改变
        this.verson++;

        return mesh;
    }

    /**
     * 获取所有的GPU网格资源
     * @returns {Map<string, any>}
     */
    GetAllGpuMeshes() {
        return this._gpuMeshes;
    }

    /**
     * 清空场景
     * 同时清除THREE场景和GPU资源
     */
    Clear() {
        // 清除THREE场景
        while (this.children.length > 0) {
            this.remove(this.children[0]);
        }

        // 清除GPU资源映射表
        this._gpuMeshes.clear();

        // 清理SceneBuffer相关资源
        if (this._ResourceManager.HasResource(this.SceneBufferName)) {
            this._ResourceManager.DeleteResource(this.SceneBufferName);
            this._ResourceManager.DeleteResource(this.SceneBufferLayoutName);
            this._ResourceManager.DeleteResource('SceneBufferBindGroup');
            this.SceneBufferBindGroup = null;
        }
    }

    /**
     * 更新当前的SceneBuffer
     * @param {number} DeltaTime 
     */
    async Update(DeltaTime) {
        if (!this.MainCamera) {
            console.warn('Main camera not set in scene');
            return;
        }

        // 确保相机矩阵是最新的
        this.MainCamera.updateMatrixWorld(true); // 强制更新整个矩阵链

        // 更新场景中所有对象的世界矩阵
        this.traverse((object) => {
            if (object.matrixAutoUpdate) {
                object.updateMatrix();
            }
            if (object.parent) {
                object.matrixWorld.multiplyMatrices(object.parent.matrixWorld, object.matrix);
            }
        });

        // 如果SceneBuffer不存在，创建它
        if (!this._ResourceManager.HasResource(this.SceneBufferName)) {
            await this.#CreateSceneBuffer();
        }

        // 更新SceneBuffer数据
        const sceneBuffer = this._ResourceManager.GetResource(this.SceneBufferName);
        const device = await this._ResourceManager.GetDevice();

        // 计算相机方向、上方向和右方向向量
        const cameraDirection = new THREE.Vector3(0, 0, -1);
        cameraDirection.applyQuaternion(this.MainCamera.quaternion);
        
        const cameraUp = new THREE.Vector3(0, 1, 0);
        cameraUp.applyQuaternion(this.MainCamera.quaternion);
        
        const cameraRight = new THREE.Vector3(1, 0, 0);
        cameraRight.applyQuaternion(this.MainCamera.quaternion);

        // 准备场景数据
        const sceneData = new Float32Array([
            // View Matrix (4x4)
            ...this.MainCamera.matrixWorldInverse.elements,
            // Projection Matrix (4x4)
            ...this.MainCamera.projectionMatrix.elements,
            // Camera Position (vec4)
            this.MainCamera.position.x,
            this.MainCamera.position.y,
            this.MainCamera.position.z,
            0, // padding
            // Camera Direction (vec4)
            cameraDirection.x,
            cameraDirection.y,
            cameraDirection.z,
            0, // padding
            // Camera Up (vec4)
            cameraUp.x,
            cameraUp.y,
            cameraUp.z,
            0, // padding
            // Camera Right (vec4)
            cameraRight.x,
            cameraRight.y,
            cameraRight.z,
            0, // padding
            // Time and Delta (vec4)
            this.time,
            DeltaTime,
            0, // padding
            0  // padding
        ]);

        // 写入数据到buffer
        device.queue.writeBuffer(sceneBuffer, 0, sceneData);
        
        // 更新时间
        this.time += DeltaTime;
    }

    /**
     * 创建场景buffer及其绑定组
     * @private
     */
    async #CreateSceneBuffer() {
        // 创建场景buffer
        await this._ResourceManager.CreateResource(
            this.SceneBufferName,
            {
                Type: 'Buffer',
                desc: {
                    size: (16 + 16 + 4 + 4 + 4 + 4 + 4) * 4, 
                    /**
                     * 4x4 view + 
                     * 4x4 proj + 
                     * vec4 camPos + 
                     * vec4 camDir + 
                     * vec4 camUp +
                     * vec4 camRight +
                     * vec4 timeDelta
                     */ 
                    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
                }
            }
        );

        // 创建绑定组布局
        await this._ResourceManager.CreateResource(
            this.SceneBufferLayoutName,
            {
                Type: 'BindGroupLayout',
                desc: {
                    entries: [
                        {
                            binding: 0,
                            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                            buffer: {
                                type: 'uniform'
                            }
                        }
                    ]
                }
            }
        );

        // 创建绑定组
        this.SceneBufferBindGroup = await this._ResourceManager.CreateResource(
            'SceneBufferBindGroup',
            {
                Type: 'BindGroup',
                desc: {
                    layout: this._ResourceManager.GetResource(this.SceneBufferLayoutName),
                    entries: [
                        {
                            binding: 0,
                            resource: {
                                buffer: this._ResourceManager.GetResource(this.SceneBufferName)
                            }
                        }
                    ]
                }
            }
        );
    }

    /**
     * 设置主相机
     * @param {THREE.PerspectiveCamera} camera 
     */
    SetMainCamera(camera) {
        this.MainCamera = camera;
        this.verson++; // 触发场景更新
    }

    /**
     * 获取场景Buffer的绑定组布局
     * @returns {GPUBindGroupLayout}
     */
    GetSceneBufferLayout() {
        return this._ResourceManager.GetResource(this.SceneBufferLayoutName);
    }
}

export default FScene;