import { MaterialDomain, BlendMode, ShaderModel } from './MaterialSystem.js';


export class BaseMaterial {
    /**
     * 构造函数
     * @param {number} MaterialDomain - 材质域
     * @param {number} BlendMode - 混合模式
     * @param {number} ShaderModel - 着色模型
     * @param {string} ClipMode - 裁剪模式 'back' / 'front' / 'none'
     */
    constructor(MaterialDomain, BlendMode, ShaderModel, ClipMode) {
        this.MaterialDomain = MaterialDomain;
        this.BlendMode = BlendMode;
        this.ShaderModel = ShaderModel;
        this.ClipMode = ClipMode;
    }

    /**
     * 获取材质信息
     * @returns {Float32Array} size = f32x4 材质信息
     */
    getMaterialInfo() {
        const clipMode = this.ClipMode === 'back' ? 0 : this.ClipMode === 'front' ? 1 : 2;
        return new Float32Array([this.MaterialDomain, this.BlendMode, this.ShaderModel, clipMode]);
    }

    /**
     * 判断两个材质是否相同
     * @param {Object} materialDesc - 材质描述对象
     * @returns {boolean} 是否相同
     */
    isSameMaterial(materialDesc) {
        return this.MaterialDomain === materialDesc.MaterialDomain &&
               this.BlendMode === materialDesc.BlendMode &&
               this.ShaderModel === materialDesc.ShaderModel &&
               this.ClipMode === materialDesc.ClipMode;
    }
}