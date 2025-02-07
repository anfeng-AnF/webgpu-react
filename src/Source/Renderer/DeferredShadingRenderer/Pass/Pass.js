import FResourceManager from '../../../Core/Resource/FResourceManager';

/**
 * 渲染pass
 */
class FPass{

    /**
     * 资源 声明自己创建和管理的资源，以及依赖的资源 （资源名称）
     * @type {{
     *   PassName: string,
     *   Resources: {
     *     Dependence: {
     *       Texture?: string[],
     *       Pipeline?: string[],
     *       Buffer?: string[],
     *       BindGroup?: string[],
     *       BindGroupLayout?: string[],
     *       ShaderModule?: string[]
     *     },
     *     Managed: {
     *       Texture?: string[],
     *       Pipeline?: string[],
     *       Buffer?: string[],
     *       BindGroup?: string[],
     *       BindGroupLayout?: string[],
     *       ShaderModule?: string[]
     *     },
     *     Output: {
     *       Texture?: string[],
     *       Pipeline?: string[],
     *       Buffer?: string[],
     *       BindGroup?: string[],
     *       BindGroupLayout?: string[]
     *     }
     *   }
     * }}
     * @protected
     */
    _Resources = {};

    /**
     * 名称
     * @type {string}
     * @protected
     */
    _Name = '';

    /**
     * 资源管理器
     * @type {FResourceManager}
     * @protected
     */
    _ResourceManager = null;

    /**
     * 是否初始化完成
     * @type {boolean}
     * @protected
     */
    _bInitialized = false;

    /**
     * 构造函数
     */
    constructor(){
        /**
         * 资源管理器
         * @type {FResourceManager}
         * @protected
         */
        this._ResourceManager = FResourceManager.GetInstance();

        /**
         * Pass名称
         * @type {string}
         * @protected
         */
        this._Name = '';

        /**
         * 是否初始化完成
         * @type {boolean}
         * @protected
         */
        this._bInitialized = false;
    }

    /**
     * 初始化资源名称
     */
    async InitResourceName(){
        throw new Error('Not implemented');
    }

    /**
     * 初始化
     */
    async Initialize(){

    }

    /**
     * 销毁
     */
    async Destroy(){

    }

    /**
     * 渲染
     * @param {number} DeltaTime 时间差
     * @param {GPUCommandEncoder} CommandEncoder 命令编码器
     */
    Render(DeltaTime,CommandEncoder){

    }

    /**
     * 渲染目标大小改变
     * @param {number} Width 宽度
     * @param {number} Height 高度
     */
    OnRenderTargetResize(Width,Height){

    }

    /**
     * 获取名称
     * @returns {string}
     */
    GetName(){
        return this._Name;
    }
}
export default FPass;
