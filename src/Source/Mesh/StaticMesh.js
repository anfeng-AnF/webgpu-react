import * as THREE from 'three';
import FResourceManager, { EResourceType } from '../Core/Resource/FResourceManager';
import FMaterialBase from './Material/MaterialBase';
/**
 * 静态网格 通过Three.js的Mesh创建Gpu数据并进行管理
 */ 
class FStaticMesh {
    /**
     * 顶点缓冲区名称
     * @type {string}
     */
    VertexBufferName = '';  
    /**
     * 索引缓冲区名称
     * @type {string}
     */
    IndexBufferName = '';
    /**
     * 顶点数量
     * @type {number}
     */
    VertexCount = 0;
    /**
     * 索引数量
     * @type {number}
     */
    IndexCount = 0;

    /**
     * 是否是索引化网格
     * @type {boolean}
     */
    bIndexedMesh = false;

    /**
     * 模型矩阵 4x4 默认单位矩阵
     * @type {Float32Array} 
     */
    ModuleMatrix = new Float32Array(
        [1,0,0,0,
         0,1,0,0,
         0,0,1,0,
         0,0,0,1]
    );

    /**
     * 索引缓冲区类型
     * @type {string}
     */
    IndexBufferType = 'uint16';

    /**
     * 顶点缓冲区Desc
     * @type {JSON}
     */
    static VertexBufferDesc = {
        arrayStride: 68, // Position(12) + Normal(12) + Tangent(12) + UV0(8) + UV1(8) + UV2(8) + UV3(8)
        attributes: [
            {
                shaderLocation: 0,
                offset: 0,
                format: 'float32x3', // Position
            },
            {
                shaderLocation: 1,
                offset: 12,
                format: 'float32x3', // Normal
            },
            {
                shaderLocation: 2,
                offset: 24,
                format: 'float32x3', // Tangent
            },
            {
                shaderLocation: 3,
                offset: 36,
                format: 'float32x2', // UV0
            },
            {
                shaderLocation: 4,
                offset: 44,
                format: 'float32x2', // UV1
            },
            {
                shaderLocation: 5,
                offset: 52,
                format: 'float32x2', // UV2
            },
            {
                shaderLocation: 6,
                offset: 60,
                format: 'float32x2', // UV3
            },
        ],
    };

    /**
     * 几何数据，引用 THREE.BufferGeometry 对象
     * @type {THREE.BufferGeometry|null}
     */
    Geometry = null;

    /**
     * 材质
     * @type {FMaterialBase|F}
     */
    Material = null;


    /**
     * 构造函数
     * @param {THREE.Mesh} Mesh 
     */
    async Initialize(Mesh) {
        const ResourceManager = FResourceManager.GetInstance();

        this.Geometry = Mesh.geometry;
        this.VertexBufferName = Mesh.ID + '_VertexBuffer';
        this.IndexBufferName = Mesh.ID + '_IndexBuffer';
        
        // 确保几何体有必要的属性
        if (!this.Geometry.attributes.normal) {
            this.Geometry.computeVertexNormals();
        }
        if (!this.Geometry.attributes.tangent) {
            this.Geometry.computeTangents();
        }
        if (!this.Geometry.attributes.uv) {
            console.warn(`Mesh ${Mesh.ID} has no UV coordinates`);
            // 创建默认UV
            const positions = this.Geometry.attributes.position.array;
            const uvs = new Float32Array(positions.length * 2/3);
            this.Geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        }

        // 计算需要的顶点数据大小
        const vertexCount = this.Geometry.attributes.position.count;
        const vertexSize = 17; // position(3) + normal(3) + tangent(3) + uv0(2) + uv1(2) + uv2(2) + uv3(2)
        const meshDataArray = new Float32Array(vertexCount * vertexSize);

        // 填充顶点数据
        for(let i = 0; i < vertexCount; i++) {
            const offset = i * vertexSize;
            
            // Position (3)
            meshDataArray[offset] = this.Geometry.attributes.position.array[i * 3];
            meshDataArray[offset + 1] = this.Geometry.attributes.position.array[i * 3 + 1];
            meshDataArray[offset + 2] = this.Geometry.attributes.position.array[i * 3 + 2];

            // Normal (3)
            meshDataArray[offset + 3] = this.Geometry.attributes.normal.array[i * 3];
            meshDataArray[offset + 4] = this.Geometry.attributes.normal.array[i * 3 + 1];
            meshDataArray[offset + 5] = this.Geometry.attributes.normal.array[i * 3 + 2];

            // Tangent (3)
            meshDataArray[offset + 6] = this.Geometry.attributes.tangent.array[i * 4];
            meshDataArray[offset + 7] = this.Geometry.attributes.tangent.array[i * 4 + 1];
            meshDataArray[offset + 8] = this.Geometry.attributes.tangent.array[i * 4 + 2];

            // UV0 (2)
            meshDataArray[offset + 9] = this.Geometry.attributes.uv.array[i * 2];
            meshDataArray[offset + 10] = this.Geometry.attributes.uv.array[i * 2 + 1];

            // UV1-UV3 (6) - 使用默认值 0
            for(let j = 11; j < vertexSize; j++) {
                meshDataArray[offset + j] = 0;
            }
        }

        this.VertexCount = vertexCount;
        
        // 创建顶点缓冲区
        await ResourceManager.CreateResource(this.VertexBufferName, {
            Type: 'Buffer',
            desc: {
                size: meshDataArray.byteLength,
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            }
        });

        const device = await ResourceManager.GetDevice();
        device.queue.writeBuffer(
            ResourceManager.GetResource(this.VertexBufferName),
            0,
            meshDataArray
        );

        // 处理索引缓冲区
        if(this.Geometry.index) {
            this.bIndexedMesh = true;
            this.IndexCount = this.Geometry.index.count;
            
            await ResourceManager.CreateResource(this.IndexBufferName, {
                Type: 'Buffer',
                desc: {
                    size: this.Geometry.index.array.byteLength,
                    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
                }
            });
            device.queue.writeBuffer(
                ResourceManager.GetResource(this.IndexBufferName),
                0,
                this.Geometry.index.array
            );
        }
    }

    /**
     * 创建静态网格
     * @param {THREE.Mesh} Mesh 
     * @returns {Promise<FStaticMesh>}
     */
    static async Create(Mesh) {
        const mesh = new FStaticMesh();
        await mesh.Initialize(Mesh);
        return mesh;
    }

    /**
     * 设置模型矩阵
     * @param {Float32Array} Matrix 
     */
    setModuleMatrix(Matrix){
        this.ModuleMatrix = Matrix;
    }
}

export default FStaticMesh;




