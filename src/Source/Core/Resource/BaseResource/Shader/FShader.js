import { FResource } from '../FResource';

/**
 * 着色器类型枚举
 * @enum {string}
 */
export const EShaderType = {
    VERTEX: 'vertex',
    FRAGMENT: 'fragment',
    COMPUTE: 'compute'
};

/**
 * 着色器资源基类
 * 管理着色器代码和编译
 * 
 * @example
 * // 通常不直接使用FShader，而是使用其子类
 * class FCustomShader extends FShader {
 *     constructor(device, desc) {
 *         super(device, {
 *             ...desc,
 *             type: EShaderType.VERTEX
 *         });
 *     }
 * }
 * 
 * @note
 * 1. 提供着色器编译和错误处理
 * 2. 支持从字符串或文件加载
 * 3. 自动处理着色器模块生命周期
 * 4. 支持着色器编译信息查询
 */
export class FShader extends FResource {
    /**
     * @param {GPUDevice} device - GPU设备
     * @param {Object} desc - 着色器描述符
     * @param {string} desc.name - 资源名称
     * @param {EShaderType} desc.type - 着色器类型
     * @param {string} [desc.code] - 着色器代码
     */
    constructor(device, desc) {
        super(device, desc);
        
        this.type = desc.type;
        this.code = desc.code || '';
        this.compileInfo = null;
    }

    /**
     * 设置着色器代码
     * @param {string} code - WGSL代码
     */
    setCode(code) {
        this.code = code;
        this.gpuResource = null;  // 使着色器模块失效
    }

    /**
     * 从文件加载着色器代码
     * @param {string} url - 着色器文件URL
     */
    async loadFromFile(url) {
        const response = await fetch(url);
        this.code = await response.text();
        this.gpuResource = null;
    }

    /**
     * 创建着色器模块
     * @protected
     */
    create() {
        try {
            this.gpuResource = this.device.createShaderModule({
                code: this.code,
                label: this.name
            });
            this.compileInfo = null;  // 清除旧的编译信息
        } catch (error) {
            this.compileInfo = error;
            throw error;
        }
    }

    /**
     * 获取着色器布局
     * @returns {Object} 着色器布局描述符
     */
    getLayout() {
        return {
            type: 'shader',
            shaderType: this.type
        };
    }

    /**
     * 获取编译信息
     * @returns {Object|null} 编译信息
     */
    getCompileInfo() {
        return this.compileInfo;
    }
} 