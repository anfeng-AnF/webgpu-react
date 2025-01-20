import { FBuffer } from './FBuffer';

/**
 * Uniform数据类型枚举
 * @enum {string}
 */
export const EUniformType = {
    FLOAT: 'FLOAT',
    FLOAT2: 'FLOAT2',
    FLOAT3: 'FLOAT3',
    FLOAT4: 'FLOAT4',
    INT: 'INT',
    INT2: 'INT2',
    INT3: 'INT3',
    INT4: 'INT4',
    UINT: 'UINT',
    UINT2: 'UINT2',
    UINT3: 'UINT3',
    UINT4: 'UINT4',
    MAT2X2: 'MAT2X2',
    MAT3X3: 'MAT3X3',
    MAT4X4: 'MAT4X4',
    BOOL: 'BOOL'
};

/**
 * Uniform缓冲区类
 * 管理Uniform数据和内存布局
 * 
 * @example
 * // 1. 动态构建材质参数缓冲区
 * const materialBuffer = new FUniformBuffer(device, {
 *     name: "materialParams"
 * });
 * 
 * // 动态添加uniform变量
 * materialBuffer
 *     .addUniform("baseColor", EUniformType.FLOAT4)
 *     .addUniform("metallic", EUniformType.FLOAT)
 *     .addUniform("roughness", EUniformType.FLOAT)
 *     .addUniform("emissive", EUniformType.FLOAT3)
 *     .build();  // 完成布局并创建缓冲区
 * 
 * // 设置数据
 * materialBuffer.setUniformValue("baseColor", [1, 0, 0, 1]);
 * materialBuffer.setUniformValue("metallic", 0.5);
 * materialBuffer.setUniformValue("roughness", 0.7);
 * materialBuffer.setUniformValue("emissive", [0, 0, 0]);
 * 
 * // 更新GPU数据
 * await materialBuffer.updateData();
 * 
 * // 2. 使用预设布局
 * const transformBuffer = FUniformBuffer.createTransformBuffer(device, "transform");
 * transformBuffer.setUniformValue("modelMatrix", modelMatrix);
 * transformBuffer.setUniformValue("viewMatrix", viewMatrix);
 * transformBuffer.setUniformValue("projectionMatrix", projMatrix);
 * await transformBuffer.updateData();
 * 
 * // 3. 在着色器中使用
 * // @group(0) @binding(0) var<uniform> material: MaterialUniforms;
 * // struct MaterialUniforms {
 * //     baseColor: vec4f,
 * //     metallic: f32,
 * //     roughness: f32,
 * //     emissive: vec3f,
 * // }
 * 
 * @note
 * 1. 支持动态构建布局
 * 2. 自动计算对齐和大小
 * 3. 自动处理256字节对齐要求
 * 4. 数据更新后需要调用updateData()同步到GPU
 * 5. 布局必须与着色器中的结构体定义匹配
 */
export class FUniformBuffer extends FBuffer {
    /**
     * @param {GPUDevice} device - GPU设备
     * @param {Object} desc - Uniform缓冲区描述符
     * @param {string} desc.name - 资源名称
     * @param {number} [desc.size] - 可选的初始大小（字节）
     */
    constructor(device, desc) {
        super(device, {
            ...desc,
            size: desc.size || 256, // 初始默认大小
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            mappable: false
        });

        this.dataLayout = new Map();
        this.totalSize = 0;
        this.isBuilt = false;
    }

    /**
     * 添加Uniform变量
     * @param {string} name - 变量名称
     * @param {EUniformType} type - 变量类型
     * @returns {FUniformBuffer} this，用于链式调用
     */
    addUniform(name, type) {
        if (this.isBuilt) {
            throw new Error('Cannot add uniforms after buffer is built');
        }

        if (!this.validateUniform(name, type)) {
            throw new Error(`Invalid uniform: ${name}`);
        }

        const size = this.getSizeFromType(type);
        const alignment = this.getAlignmentFromType(type);
        const offset = this.calculateUniformOffset(alignment);

        this.dataLayout.set(name, {
            type,
            offset,
            size,
            alignment
        });

        this.totalSize = Math.max(this.totalSize, offset + size);
        return this;
    }

    /**
     * 完成布局并创建缓冲区
     * @returns {FUniformBuffer} this
     */
    build() {
        if (this.isBuilt) {
            throw new Error('Buffer is already built');
        }

        // 确保总大小是256字节的整数倍
        this.size = Math.ceil(this.totalSize / 256) * 256;
        this.data = new ArrayBuffer(this.size);
        this.dataView = new DataView(this.data);
        this.isBuilt = true;

        // 创建GPU资源
        this.create();
        return this;
    }

    /**
     * 设置Uniform值
     * @param {string} name - 变量名称
     * @param {number|Array|Float32Array} value - 变量值
     */
    setUniformValue(name, value) {
        if (!this.isBuilt) {
            throw new Error('Buffer must be built before setting values');
        }

        const uniform = this.dataLayout.get(name);
        if (!uniform) {
            throw new Error(`Uniform not found: ${name}`);
        }

        const { type, offset } = uniform;
        this.writeValueToBuffer(value, type, offset);
    }

    /**
     * 获取Uniform值
     * @param {string} name - 变量名称
     * @returns {number|Array} 变量值
     */
    getUniformValue(name) {
        const uniform = this.dataLayout.get(name);
        if (!uniform) {
            throw new Error(`Uniform not found: ${name}`);
        }

        const { type, offset } = uniform;
        return this.readValueFromBuffer(type, offset);
    }

    /**
     * 更新GPU缓冲区数据
     */
    async updateData() {
        await this.setData(this.data);
    }

    /**
     * 获取缓冲区布局
     * @returns {GPUBufferLayout} 缓冲区布局描述符
     */
    getLayout() {
        return {
            type: 'uniform',
            minBindingSize: this.totalSize
        };
    }

    /**
     * 从类型获取大小
     * @protected
     * @param {EUniformType} type - Uniform类型
     * @returns {number} 大小（字节）
     */
    getSizeFromType(type) {
        const sizeMap = {
            [EUniformType.FLOAT]: 4,
            [EUniformType.FLOAT2]: 8,
            [EUniformType.FLOAT3]: 12,
            [EUniformType.FLOAT4]: 16,
            [EUniformType.INT]: 4,
            [EUniformType.INT2]: 8,
            [EUniformType.INT3]: 12,
            [EUniformType.INT4]: 16,
            [EUniformType.UINT]: 4,
            [EUniformType.UINT2]: 8,
            [EUniformType.UINT3]: 12,
            [EUniformType.UINT4]: 16,
            [EUniformType.MAT2X2]: 16,
            [EUniformType.MAT3X3]: 36,
            [EUniformType.MAT4X4]: 64,
            [EUniformType.BOOL]: 4
        };
        return sizeMap[type];
    }

    /**
     * 从类型获取对齐要求
     * @protected
     * @param {EUniformType} type - Uniform类型
     * @returns {number} 对齐大小（字节）
     */
    getAlignmentFromType(type) {
        // vec3需要vec4对齐
        if (type.endsWith('3')) return 16;
        return this.getSizeFromType(type);
    }

    /**
     * 计算Uniform偏移
     * @protected
     * @param {number} alignment - 对齐要求
     * @returns {number} 对齐后的偏移
     */
    calculateUniformOffset(alignment) {
        return Math.ceil(this.totalSize / alignment) * alignment;
    }

    /**
     * 写入值到缓冲区
     * @protected
     * @param {number|Array|Float32Array} value - 要写入的值
     * @param {EUniformType} type - 值类型
     * @param {number} offset - 写入偏移
     */
    writeValueToBuffer(value, type, offset) {
        switch (type) {
            case EUniformType.FLOAT:
                this.dataView.setFloat32(offset, value, true);
                break;
            case EUniformType.INT:
                this.dataView.setInt32(offset, value, true);
                break;
            case EUniformType.UINT:
                this.dataView.setUint32(offset, value, true);
                break;
            case EUniformType.BOOL:
                this.dataView.setInt32(offset, value ? 1 : 0, true);
                break;
            default:
                if (Array.isArray(value) || ArrayBuffer.isView(value)) {
                    const floatArray = new Float32Array(this.data, offset);
                    floatArray.set(value);
                }
                break;
        }
    }

    /**
     * 从缓冲区读取值
     * @protected
     * @param {EUniformType} type - 值类型
     * @param {number} offset - 读取偏移
     * @returns {number|Array} 读取的值
     */
    readValueFromBuffer(type, offset) {
        switch (type) {
            case EUniformType.FLOAT:
                return this.dataView.getFloat32(offset, true);
            case EUniformType.INT:
                return this.dataView.getInt32(offset, true);
            case EUniformType.UINT:
                return this.dataView.getUint32(offset, true);
            case EUniformType.BOOL:
                return this.dataView.getInt32(offset, true) !== 0;
            default:
                const size = this.getSizeFromType(type) / 4;
                return Array.from(new Float32Array(this.data, offset, size));
        }
    }

    /**
     * 验证Uniform
     * @protected
     * @param {string} name - 变量名称
     * @param {EUniformType} type - 变量类型
     * @returns {boolean} 验证结果
     */
    validateUniform(name, type) {
        return (
            typeof name === 'string' &&
            name.length > 0 &&
            Object.values(EUniformType).includes(type) &&
            !this.dataLayout.has(name)
        );
    }

    // 静态工厂方法
    /**
     * 创建变换矩阵缓冲区
     * @param {GPUDevice} device - GPU设备
     * @param {string} name - 资源名称
     * @returns {FUniformBuffer} Uniform缓冲区
     */
    static createTransformBuffer(device, name) {
        return new FUniformBuffer(device, { name })
            .addUniform("modelMatrix", EUniformType.MAT4X4)
            .addUniform("viewMatrix", EUniformType.MAT4X4)
            .addUniform("projectionMatrix", EUniformType.MAT4X4)
            .build();
    }

    /**
     * 创建材质参数Uniform缓冲区
     * @param {GPUDevice} device - GPU设备
     * @param {string} name - 资源名称
     * @returns {FUniformBuffer} Uniform缓冲区
     */
    static createMaterialBuffer(device, name) {
        const buffer = new FUniformBuffer(device, { name });
        buffer.addUniform("baseColor", EUniformType.FLOAT4);
        buffer.addUniform("metallic", EUniformType.FLOAT);
        buffer.addUniform("roughness", EUniformType.FLOAT);
        buffer.addUniform("emissive", EUniformType.FLOAT3);
        return buffer;
    }

    /**
     * 获取变换矩阵布局
     * @returns {GPUBufferLayout} 缓冲区布局
     */
    static getTransformBufferLayout() {
        const tempBuffer = new FUniformBuffer(null, { name: "temp" });
        tempBuffer.addUniform("modelMatrix", EUniformType.MAT4X4);
        tempBuffer.addUniform("viewMatrix", EUniformType.MAT4X4);
        tempBuffer.addUniform("projectionMatrix", EUniformType.MAT4X4);
        return tempBuffer.getLayout();
    }

    /**
     * 获取材质参数布局
     * @returns {GPUBufferLayout} 缓冲区布局
     */
    static getMaterialBufferLayout() {
        const tempBuffer = new FUniformBuffer(null, { name: "temp" });
        tempBuffer.addUniform("baseColor", EUniformType.FLOAT4);
        tempBuffer.addUniform("metallic", EUniformType.FLOAT);
        tempBuffer.addUniform("roughness", EUniformType.FLOAT);
        tempBuffer.addUniform("emissive", EUniformType.FLOAT3);
        return tempBuffer.getLayout();
    }
} 