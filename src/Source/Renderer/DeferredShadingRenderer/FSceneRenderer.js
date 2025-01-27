

class FSceneRenderer{

    constructor(){
        /**
         * @type {boolean} 渲染器开始渲染
         * @protected
         */
        this._bBeginRender = false;
        /**
         * @type {boolean} 渲染器初始化完成
         * @protected
         */
        this._bInitialized = false;
        /**
         * @type {boolean} 画布尺寸变化完成
         * @protected
         */
        this._bResizeCompleted = false;

        /**
         * @type {boolean} 画布准备完成
         * @protected
         */
        this._bCanvasReady = false;
    }
    /**
     * 初始化渲染器
     */
    async Initialize(){
        throw new Error('Not child class implemented');
    }

    /**
     * 画布尺寸变化
     * @param {number} Width 宽度
     * @param {number} Height 高度
     * @param {HTMLCanvasElement} Canvas 画布
     */
    async OnCanvasResize(Width, Height,Canvas){
        throw new Error('Not child class implemented');
    }

    /**
     * 画布准备完成
     * @param {HTMLCanvasElement} Canvas 画布
     */
    async OnCanvasReady(Canvas){
        throw new Error('Not child class implemented');
    }

    /**
     * 渲染场景
     * @param {number} DeltaTime 时间差
     */
    async Render(DeltaTime){
        if(!this._bBeginRender||!this._bInitialized||!this._bResizeCompleted||!this._bCanvasReady){
            return;
        }
    }

    /**
     * 销毁渲染器
     */
    async Destroy(){
        throw new Error('Not child class implemented');
    }
}

export default FSceneRenderer;
