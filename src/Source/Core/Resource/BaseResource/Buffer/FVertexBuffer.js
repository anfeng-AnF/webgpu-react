import { FBuffer } from './FBuffer';

/**
 * 顶点属性类型枚举
 * @enum {string}
 */
export const EVertexAttribute = {
    POSITION_2D: 'POSITION_2D',
    POSITION_3D: 'POSITION_3D',
    NORMAL: 'NORMAL',
    TANGENT: 'TANGENT',
    BITANGENT: 'BITANGENT',
    UV: 'UV',
    UV2: 'UV2',
    COLOR_RGB: 'COLOR_RGB',
    COLOR_RGBA: 'COLOR_RGBA',
    JOINTS_4: 'JOINTS_4',
    WEIGHTS_4: 'WEIGHTS_4'
};

/**
 * 顶点缓冲区类
 * 管理顶点数据和属性布局
 * 
 * @example
 * // 1. 创建静态网格顶点缓冲区
 * const vertexBuffer = FVertexBuffer.createStaticMesh(device, "mesh");
 * 
 * // 设置顶点数据
 * const vertices = new Float32Array([
 *     // 位置            法线           UV
 *     -1.0, -1.0, 0.0,  0, 0, 1,     0, 0,  // 顶点0
 *      1.0, -1.0, 0.0,  0, 0, 1,     1, 0,  // 顶点1
 *      0.0,  1.0, 0.0,  0, 0, 1,     0.5, 1 // 顶点2
 * ]);
 * await vertexBuffer.setData(vertices);
 * 
 * // 2. 创建骨骼网格顶点缓冲区
 * const skinnedBuffer = FVertexBuffer.createSkeletalMesh(device, "character");
 * 
 * // 设置带骨骼权重的顶点数据
 * const skinnedVertices = new Float32Array([
 *     // 位置       法线      UV    骨骼索引    权重
 *     // ... 顶点数据 ...
 * ]);
 * await skinnedBuffer.setData(skinnedVertices);
 * 
 * // 3. 在渲染管线中使用
 * // 设置顶点缓冲区
 * renderPass.setVertexBuffer(0, vertexBuffer.getResource());
 * 
 * // 4. 对应的着色器顶点输入布局
 * // struct VertexInput {
 * //     @location(0) position: vec3f,
 * //     @location(1) normal: vec3f,
 * //     @location(2) uv: vec2f,
 * // }
 * 
 * @note
 * 1. 顶点数据必须按照布局定义的格式排列
 * 2. 属性位置(location)必须与着色器输入匹配
 * 3. 支持静态网格和骨骼网格两种预设布局
 * 4. 可以自定义添加其他顶点属性
 */
export class FVertexBuffer extends FBuffer {
    /**
     * @param {GPUDevice} device - GPU设备
     * @param {Object} desc - 顶点缓冲区描述符
     * @param {string} desc.name - 资源名称
     * @param {number} desc.size - 缓冲区大小（字节）
     */
    constructor(device, desc) {
        super(device, {
            ...desc,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });
        
        this.attributes = new Map();
        this.totalSize = 0;
        this.stride = 0;
    }

    /**
     * 添加顶点属性
     * @param {string} name - 属性名称
     * @param {EVertexAttribute} type - 属性类型
     * @param {number} shaderLocation - 着色器位置
     */
    addAttribute(name, type, shaderLocation) {
        if (!this.validateAttribute(name, type)) {
            throw new Error(`Invalid vertex attribute: ${name}`);
        }

        const format = this.getFormatFromType(type);
        const offset = this.calculateAttributeOffset();

        this.attributes.set(name, {
            type,
            format,
            offset,
            shaderLocation
        });

        this.calculateOffsets();
    }

    /**
     * 获取顶点属性
     * @param {string} name - 属性名称
     * @returns {Object} 属性信息
     */
    getAttribute(name) {
        return this.attributes.get(name);
    }

    /**
     * 检查是否存在属性
     * @param {string} name - 属性名称
     * @returns {boolean} 是否存在
     */
    hasAttribute(name) {
        return this.attributes.has(name);
    }

    /**
     * 移除顶点属性
     * @param {string} name - 属性名称
     */
    removeAttribute(name) {
        this.attributes.delete(name);
        this.calculateOffsets();
    }

    /**
     * 获取顶点步长
     * @returns {number} 步长（字节）
     */
    getStride() {
        return this.stride;
    }

    /**
     * 获取顶点布局
     * @returns {GPUVertexBufferLayout} 顶点缓冲区布局
     */
    getLayout() {
        const attributes = Array.from(this.attributes.values()).map(attr => ({
            format: attr.format,
            offset: attr.offset,
            shaderLocation: attr.shaderLocation
        }));

        return {
            arrayStride: this.stride,
            attributes,
            stepMode: 'vertex'
        };
    }

    /**
     * 从类型获取格式
     * @protected
     * @param {EVertexAttribute} type - 属性类型
     * @returns {GPUVertexFormat} GPU顶点格式
     */
    getFormatFromType(type) {
        const formatMap = {
            [EVertexAttribute.POSITION_2D]: 'float32x2',
            [EVertexAttribute.POSITION_3D]: 'float32x3',
            [EVertexAttribute.NORMAL]: 'float32x3',
            [EVertexAttribute.TANGENT]: 'float32x3',
            [EVertexAttribute.BITANGENT]: 'float32x3',
            [EVertexAttribute.UV]: 'float32x2',
            [EVertexAttribute.UV2]: 'float32x2',
            [EVertexAttribute.COLOR_RGB]: 'float32x3',
            [EVertexAttribute.COLOR_RGBA]: 'float32x4',
            [EVertexAttribute.JOINTS_4]: 'uint32x4',
            [EVertexAttribute.WEIGHTS_4]: 'float32x4'
        };
        return formatMap[type];
    }

    /**
     * 获取属性大小
     * @protected
     * @param {GPUVertexFormat} format - GPU顶点格式
     * @returns {number} 大小（字节）
     */
    getFormatSize(format) {
        const sizeMap = {
            'float32x2': 8,
            'float32x3': 12,
            'float32x4': 16,
            'uint32x4': 16
        };
        return sizeMap[format];
    }

    /**
     * 计算属性偏移
     * @protected
     * @returns {number} 偏移（字节）
     */
    calculateAttributeOffset() {
        let offset = 0;
        for (const attr of this.attributes.values()) {
            offset += this.getFormatSize(attr.format);
        }
        return offset;
    }

    /**
     * 计算所有偏移和步长
     * @protected
     */
    calculateOffsets() {
        this.stride = 0;
        for (const attr of this.attributes.values()) {
            this.stride += this.getFormatSize(attr.format);
        }
    }

    /**
     * 验证属性
     * @protected
     * @param {string} name - 属性名称
     * @param {EVertexAttribute} type - 属性类型
     * @returns {boolean} 验证结果
     */
    validateAttribute(name, type) {
        return (
            typeof name === 'string' &&
            name.length > 0 &&
            Object.values(EVertexAttribute).includes(type) &&
            !this.attributes.has(name)
        );
    }

    // 静态工厂方法
    /**
     * 创建静态网格顶点缓冲区
     * @param {GPUDevice} device - GPU设备
     * @param {string} name - 资源名称
     * @returns {FVertexBuffer} 顶点缓冲区
     */
    static createStaticMesh(device, name) {
        const buffer = new FVertexBuffer(device, {
            name,
            size: 1024 // 默认大小，可以根据需要调整
        });
        buffer.addAttribute("position", EVertexAttribute.POSITION_3D, 0);
        buffer.addAttribute("normal", EVertexAttribute.NORMAL, 1);
        buffer.addAttribute("tangent", EVertexAttribute.TANGENT, 2);
        buffer.addAttribute("uv0", EVertexAttribute.UV, 3);
        buffer.addAttribute("uv1", EVertexAttribute.UV, 4);
        buffer.addAttribute("uv2", EVertexAttribute.UV, 5);
        buffer.addAttribute("uv3", EVertexAttribute.UV, 6);
        return buffer;
    }

    /**
     * 创建骨骼网格顶点缓冲区
     * @param {GPUDevice} device - GPU设备
     * @param {string} name - 资源名称
     * @returns {FVertexBuffer} 顶点缓冲区
     */
    static createSkeletalMesh(device, name) {
        const buffer = new FVertexBuffer(device, {
            name,
            size: 1024
        });
        buffer.addAttribute("position", EVertexAttribute.POSITION_3D, 0);
        buffer.addAttribute("normal", EVertexAttribute.NORMAL, 1);
        buffer.addAttribute("tangent", EVertexAttribute.TANGENT, 2);
        buffer.addAttribute("uv0", EVertexAttribute.UV, 3);
        buffer.addAttribute("uv1", EVertexAttribute.UV, 4);
        buffer.addAttribute("uv2", EVertexAttribute.UV, 5);
        buffer.addAttribute("uv3", EVertexAttribute.UV, 6);
        buffer.addAttribute("joints", EVertexAttribute.JOINTS_4, 7);
        buffer.addAttribute("weights", EVertexAttribute.WEIGHTS_4, 8);
        return buffer;
    }

    /**
     * 获取静态网格布局
     * @returns {GPUVertexBufferLayout} 顶点缓冲区布局
     */
    static getStaticMeshLayout() {
        const tempBuffer = new FVertexBuffer(null, { name: "temp", size: 0 });
        tempBuffer.addAttribute("position", EVertexAttribute.POSITION_3D, 0);
        tempBuffer.addAttribute("normal", EVertexAttribute.NORMAL, 1);
        tempBuffer.addAttribute("tangent", EVertexAttribute.TANGENT, 2);
        tempBuffer.addAttribute("uv0", EVertexAttribute.UV, 3);
        tempBuffer.addAttribute("uv1", EVertexAttribute.UV, 4);
        tempBuffer.addAttribute("uv2", EVertexAttribute.UV, 5);
        tempBuffer.addAttribute("uv3", EVertexAttribute.UV, 6);
        return tempBuffer.getLayout();
    }

    /**
     * 获取骨骼网格布局
     * @returns {GPUVertexBufferLayout} 顶点缓冲区布局
     */
    static getSkeletalMeshLayout() {
        const tempBuffer = new FVertexBuffer(null, { name: "temp", size: 0 });
        tempBuffer.addAttribute("position", EVertexAttribute.POSITION_3D, 0);
        tempBuffer.addAttribute("normal", EVertexAttribute.NORMAL, 1);
        tempBuffer.addAttribute("tangent", EVertexAttribute.TANGENT, 2);
        tempBuffer.addAttribute("uv0", EVertexAttribute.UV, 3);
        tempBuffer.addAttribute("uv1", EVertexAttribute.UV, 4);
        tempBuffer.addAttribute("uv2", EVertexAttribute.UV, 5);
        tempBuffer.addAttribute("uv3", EVertexAttribute.UV, 6);
        tempBuffer.addAttribute("joints", EVertexAttribute.JOINTS_4, 7);
        tempBuffer.addAttribute("weights", EVertexAttribute.WEIGHTS_4, 8);
        return tempBuffer.getLayout();
    }
} 