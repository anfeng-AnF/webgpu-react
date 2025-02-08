/**
 * 延迟渲染器中用到的资源的名称
 * @type {Object}
 */
export const resourceName = {
    Scene: {
        sceneBuffer: 'SceneBuffer',             // 新增：Scene Buffer 统一数据
        meshStorageBuffer: 'MeshStorageBuffer',   // 新增：MeshInfo 存储 Buffer
        sceneBindGroup: 'SceneBindGroup',         // 新增：场景 BindGroup
        sceneBindGroupLayout: 'SceneBindGroupLayout', // 现有：场景 BindGroupLayout
    },
    PrePass: {
        depthTexture: 'Early-zDepthTexture',
        staticMeshPipeline: 'PrePassPipeline',
        skeletalMeshPipeline: 'PrePassSkeletalPipeline',
        shaderModule: 'PrePassShaderModule',
    },
    BasePass: {
        gBufferA: 'GBufferA',           // worldNormal
        gBufferB: 'GBufferB',           // Specular,Roughness,Metallic
        gBufferC: 'GBufferC',           // BaseColor
        gBufferD: 'GBufferD',           // Additional
        staticMeshPipeline: 'BasePassPipeline',
        skeletalMeshPipeline: 'BasePassSkeletalPipeline',
        shaderModule: 'BasePassPBRShaderModule',
        basePassPipelineLayout: 'BasePassPipelineLayout',
        samplerTextureBGLayout: 'BasePassSamplerTextureBGLayout',
    },
}
