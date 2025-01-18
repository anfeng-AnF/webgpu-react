import { FPipelineState } from './FPipelineState';
import { FVertexBuffer } from '../Buffer/FVertexBuffer';

/**
 * 混合状态描述符
 * @typedef {Object} BlendState
 * @property {string} [operation='add'] - 混合操作
 * @property {string} [srcFactor='one'] - 源因子
 * @property {string} [dstFactor='zero'] - 目标因子
 */

/**
 * 颜色目标状态描述符
 * @typedef {Object} ColorTargetState
 * @property {string} format - 颜色格式
 * @property {BlendState} [blend] - 混合状态
 * @property {number} [writeMask=0xF] - 写入掩码
 */

/**
 * 深度模板状态描述符
 * @typedef {Object} DepthStencilState
 * @property {string} format - 深度模板格式
 * @property {boolean} [depthWrite=true] - 深度写入
 * @property {string} [depthCompare='less'] - 深度比较函数
 * @property {boolean} [stencilEnabled=false] - 启用模板测试
 * @property {number} [stencilReadMask=0xFF] - 模板读取掩码
 * @property {number} [stencilWriteMask=0xFF] - 模板写入掩码
 */

/**
 * 图形管线状态描述符
 * @typedef {Object} GraphicsPipelineStateDescriptor
 * @property {string} [topology='triangle-list'] - 图元拓扑
 * @property {FVertexBuffer[]} vertexBuffers - 顶点缓冲区数组
 * @property {string} vertexShader - 顶点着色器代码
 * @property {string} fragmentShader - 片段着色器代码
 * @property {ColorTargetState[]} colorTargets - 颜色目标状态数组
 * @property {DepthStencilState} [depthStencil] - 深度模板状态
 * @property {boolean} [primitiveRestart=false] - 图元重启
 * @property {number} [frontFace='ccw'] - 正面朝向
 * @property {string} [cullMode='none'] - 面剔除模式
 */

/**
 * 图形管线状态类
 */
export class FGraphicsPipelineState extends FPipelineState {
    /**
     * @param {GPUDevice} device - GPU设备
     * @param {Object} desc - 图形管线状态描述符
     * @param {string} [desc.name] - 资源名称
     * @param {PipelineLayoutDescriptor} desc.layout - 管线布局描述符
     * @param {GraphicsPipelineStateDescriptor} desc.graphics - 图形管线状态描述符
     */
    constructor(device, desc) {
        super(device, desc);

        if (!desc.graphics) {
            throw new Error('Graphics pipeline requires graphics descriptor');
        }

        /**
         * 图形管线状态描述符
         * @type {GraphicsPipelineStateDescriptor}
         * @private
         */
        this._graphicsDesc = desc.graphics;

        // 验证必要的属性
        if (!this._graphicsDesc.vertexShader) {
            throw new Error('Vertex shader is required');
        }
        if (!this._graphicsDesc.fragmentShader) {
            throw new Error('Fragment shader is required');
        }
        if (!Array.isArray(this._graphicsDesc.colorTargets)) {
            throw new Error('Color targets array is required');
        }
        if (!Array.isArray(this._graphicsDesc.vertexBuffers)) {
            throw new Error('Vertex buffers array is required');
        }
    }

    /**
     * 创建具体的管线
     * @protected
     * @override
     * @returns {Promise<void>}
     */
    async _createPipeline() {
        // 创建顶点状态
        const vertexState = {
            module: this.device.createShaderModule({
                code: this._graphicsDesc.vertexShader
            }),
            entryPoint: 'vertexMain',
            buffers: this._graphicsDesc.vertexBuffers.map(buffer => 
                buffer.getVertexBufferLayout()
            )
        };

        // 创建片段状态
        const fragmentState = {
            module: this.device.createShaderModule({
                code: this._graphicsDesc.fragmentShader
            }),
            entryPoint: 'fragmentMain',
            targets: this._graphicsDesc.colorTargets.map(target => ({
                format: target.format,
                blend: target.blend ? {
                    color: {
                        operation: target.blend.operation ?? 'add',
                        srcFactor: target.blend.srcFactor ?? 'one',
                        dstFactor: target.blend.dstFactor ?? 'zero'
                    },
                    alpha: {
                        operation: target.blend.operation ?? 'add',
                        srcFactor: target.blend.srcFactor ?? 'one',
                        dstFactor: target.blend.dstFactor ?? 'zero'
                    }
                } : undefined,
                writeMask: target.writeMask ?? 0xF
            }))
        };

        // 创建深度模板状态
        const depthStencil = this._graphicsDesc.depthStencil ? {
            format: this._graphicsDesc.depthStencil.format,
            depthWriteEnabled: this._graphicsDesc.depthStencil.depthWrite ?? true,
            depthCompare: this._graphicsDesc.depthStencil.depthCompare ?? 'less',
            stencilEnabled: this._graphicsDesc.depthStencil.stencilEnabled ?? false,
            stencilReadMask: this._graphicsDesc.depthStencil.stencilReadMask ?? 0xFF,
            stencilWriteMask: this._graphicsDesc.depthStencil.stencilWriteMask ?? 0xFF
        } : undefined;

        // 创建图形管线
        this._gpuPipeline = this.device.createRenderPipeline({
            layout: this.getGPUPipelineLayout(),
            vertex: vertexState,
            fragment: fragmentState,
            primitive: {
                topology: this._graphicsDesc.topology ?? 'triangle-list',
                stripIndexFormat: this._graphicsDesc.primitiveRestart ? 'uint32' : undefined,
                frontFace: this._graphicsDesc.frontFace ?? 'ccw',
                cullMode: this._graphicsDesc.cullMode ?? 'none'
            },
            depthStencil
        });
    }
} 