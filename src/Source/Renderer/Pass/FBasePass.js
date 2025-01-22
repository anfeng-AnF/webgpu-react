import FPass, { EPassDependencyType } from '../../Core/Resource/FPass.js';

class FBasePass extends FPass {
    #Width;
    #Height;

    /**
     * @param {string} InName Pass名称
     * @param {number} InWidth 渲染目标宽度
     * @param {number} InHeight 渲染目标高度
     */
    constructor(InName, InWidth, InHeight) {
        super(InName);
        this.#Width = InWidth;
        this.#Height = InHeight;

        // 声明GBuffer输出资源依赖
        this.AddDependency('GBufferA', EPassDependencyType.Output, {
            Description: 'GBuffer A - 法线 '
        });
        this.AddDependency('GBufferB', EPassDependencyType.Output, {
            Description: 'GBuffer B - specular,metallic,roughness'
        });
        this.AddDependency('GBufferC', EPassDependencyType.Output, {
            Description: 'GBuffer C - 基础色'
        });
        this.AddDependency('GBufferD', EPassDependencyType.Output, {
            Description: 'GBuffer D - addition'
        });
        this.AddDependency('GBufferE', EPassDependencyType.Output, {
            Description: 'GBuffer E - addition'
        });

        // 声明深度缓冲输出
        this.AddDependency('SceneDepth', EPassDependencyType.Output, {
            Description: '场景深度缓冲'
        });
    }

    /**
     * 执行基础渲染Pass
     * @param {GPUCommandEncoder} InCommandEncoder 命令编码器
     */
    Execute(InCommandEncoder) {
        if (!this.ValidateDependencies()) {
            return;
        }

        // 获取所有GBuffer资源
        const GBufferA = this.GetResource('GBufferA');
        const GBufferB = this.GetResource('GBufferB');
        const GBufferC = this.GetResource('GBufferC');
        const GBufferD = this.GetResource('GBufferD');
        const GBufferE = this.GetResource('GBufferE');
        const SceneDepth = this.GetResource('SceneDepth');
        const RenderPassDesc = {
            colorAttachments: [
                {
                    view: GBufferA.createView(),
                    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 0.0 },
                    loadOp: 'load',
                    storeOp: 'store'
                },
                {
                    view: GBufferB.createView(),
                    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 0.0 }, // 默认法线朝上，最大粗糙度
                    loadOp: 'load',
                    storeOp: 'store'
                },
                {
                    view: GBufferC.createView(),
                    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 0.0 },
                    loadOp: 'load',
                    storeOp: 'store'
                },
                {
                    view: GBufferD.createView(),
                    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 0.0 },
                    loadOp: 'load',
                    storeOp: 'store'
                },
                {
                    view: GBufferE.createView(),
                    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 0.0 },
                    loadOp: 'load',
                    storeOp: 'store'
                }
            ],
            depthStencilAttachment: {
                view: SceneDepth.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'load',
                depthStoreOp: 'discard'
            }
        };

        const PassEncoder = InCommandEncoder.beginRenderPass(RenderPassDesc);

        // 设置视口和裁剪
        PassEncoder.setViewport(
            0, 0,    // Offset
            this.#Width, this.#Height,     // Size
            0, 1     // Depth range
        );
        PassEncoder.setScissorRect(
            0, 0,    // Offset
            this.#Width, this.#Height      // Size
        );

        // TODO: 渲染场景中的所有可见对象
        // 1. 设置渲染管线
        // 2. 绑定顶点和索引缓冲
        // 3. 遍历所有可见对象
        // 4. 设置每个对象的材质参数
        // 5. 绘制对象

        PassEncoder.end();
    }

    /**
     * 更新渲染目标尺寸
     * @param {number} InWidth 宽度
     * @param {number} InHeight 高度
     */
    Resize(InWidth, InHeight) {
        this.#Width = InWidth;
        this.#Height = InHeight;
    }
}

export default FBasePass; 