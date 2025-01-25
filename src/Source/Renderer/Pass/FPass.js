import FResourceManager from '../../Core/Resource/FResourceManager.js';



/**
 * 基础Pass类
 * 用于描述渲染通道的资源依赖关系
 *    pass的资源由Initialize()方法初始化
 *          规定：
 *              1. 对一个复用资源如depthTexture，由第一次使用的pass负责创建，并且负责其resize
 *              2. 子类必须实现  1. _initializeResourceNames()方法，用于初始化资源名称配置  -- 由父类构造自动调用
 *                              2. _declareResources()方法，用于声明资源   -- 由父类构造自动调用
 *                              3. Execute()方法用于执行渲染pass    -- 渲染时调用
 *                              4. OnCanvasResize()方法用于处理Canvas尺寸变化  -- 渲染器在Canvas尺寸发生变化时调用
 *                              5. ValidateResources()方法用于验证资源是否就绪  -- 渲染器在渲染前调用
 *                              6. Initialize()方法用于初始化资源  -- 渲染器在初始化时调用
 *
 *
 *   渲染pass的资源绑定约定（BindGroup Slots）:
 *      0. 场景全局数据 (Scene Global Data)
 *          @group(0) @binding(0) var<uniform> matrices: SceneMatrices;
 *              - model/view/projection matrices
 *              - 各种矩阵的逆矩阵
 *          @group(0) @binding(1) var<uniform> camera: CameraAttributes;
 *              - position, direction, up, right vectors
 *              - aspect ratio, near/far planes
 *          @group(0) @binding(2) var<uniform> scene: SceneParameters;
 *              - time, deltaTime
 *              - global settings
 *
 *      1. 实例/变换数据 (Instance/Transform Data)
 *          @group(1) @binding(0) var<storage> instanceTransforms: array<mat4x4f>;
 *          @group(1) @binding(1) var<uniform> instanceUniforms: InstanceUniforms;
 *              - instance specific parameters
 *              - instance flags/states
 *
 *      2. 骨骼动画数据 (Skeletal Animation)
 *          @group(2) @binding(0) var<storage> boneMatrices: array<mat4x4f>;
 *          @group(2) @binding(1) var<uniform> animationUniforms: AnimationUniforms;
 *              - animation parameters
 *              - blend weights
 *
 *      3. 光照数据 (Lighting Data)
 *          @group(3) @binding(0) var<storage> lights: array<Light>;
 *          @group(3) @binding(1) var<uniform> lightingUniforms: LightingUniforms;
 *              - ambient light
 *              - shadow parameters
 *          @group(3) @binding(2) var shadowMaps: texture_depth_2d_array;
 *
 *      4. 材质数据 (Material Data)
 *          @group(4) @binding(0) var baseColorTexture: texture_2d;
 *          @group(4) @binding(1) var normalTexture: texture_2d;
 *          @group(4) @binding(2) var metallicRoughnessTexture: texture_2d;
 *          @group(4) @binding(3) var<uniform> materialUniforms: MaterialUniforms;
 *
 *      5. 后处理数据 (Post-Processing)
 *          @group(5) @binding(0) var inputTexture: texture_2d;
 *          @group(5) @binding(1) var<uniform> postProcessUniforms: PostProcessUniforms;
 *
 *      6-7. 预留给特定Pass的自定义数据 (Reserved for Pass-Specific Data)
 *
 * 直接绑定资源 (Direct Bindings):
 *      - 顶点缓冲区 (Vertex Buffers)
 *          [[location(0)]] position: vec3f
 *          [[location(1)]] normal: vec3f
 *          [[location(2)]] uv: vec2f
 *          [[location(3)]] tangent: vec4f
 *          [[location(4)]] color: vec4f
 *          [[location(5)]] joints: vec4u
 *          [[location(6)]] weights: vec4f
 *
 *      - 索引缓冲区 (Index Buffer)
 *          使用 setPipeline 和 setIndexBuffer 直接设置
 *
 *      - 渲染目标 (Render Targets)
 *          在 beginRenderPass 中通过 colorAttachments 和 depthStencilAttachment 设置
 */
class FPass {
    _name;                    // Pass名称
    /** @type {FResourceManager} */
    _resourceManager = null;  // 资源管理器
    _resourceNames = null;    // 资源名称配置，由子类实现

    constructor(InName) {
        this._name = InName;
        this._resourceManager = FResourceManager.GetInstance();
        this._initializeResourceNames();
        this._declareResources();
    }

    /**
     * 初始化资源名称配置
     * @protected
     * @abstract
     */
    _initializeResourceNames() {
        throw new Error('_initializeResourceNames() must be implemented by subclass');
    }

    /**
     * 声明Pass所需的资源
     * @protected
     * @abstract
     */
    _declareResources() {
        throw new Error('_declareResources() must be implemented by subclass');
    }

    /**
     * 验证所有资源是否就绪
     * @returns {boolean} 是否所有资源都已就绪
     */
    ValidateResources() {
        // 由子类实现具体的资源验证逻辑
        return true;
    }

    /**
     * 执行渲染pass
     * @abstract
     */
    Execute() {
        throw new Error('Execute() must be implemented by subclass');
    }

    /**
     * 初始化该pass的默认资源，Pipeline，Shader等 
     * @abstract
     */
    async Initialize() {
        throw new Error('Initialize() must be implemented by subclass');
    }

    /**
     * 当Canvas尺寸发生变化时，调用此方法
     * 子类需要实现具体的尺寸变化处理逻辑，如类中负责的Texture需要重新创建
     * @abstract
     */
    async OnCanvasResize() {
        throw new Error('OnCanvasResize() must be implemented by subclass');
    }

    /**
     * 获取Pass名称
     */
    GetName() {
        return this._name;
    }

    /**
     * 获取Pass的默认输出Texture资源名
     * @returns {string} 默认输出Texture资源名 'null'表示没有默认输出Texture
     */
    GetDefaultOutputTextureName() {
        throw new Error('GetDefaultOutputTextureName() must be implemented by subclass');
    }
}

export default FPass; 