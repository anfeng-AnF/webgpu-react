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
        sceneLightBindGroup: 'SceneLightBindGroup', // 新增：场景光照 BindGroup
        sceneLightBindGroupLayout: 'SceneLightBindGroupLayout', // 新增：场景光照 BindGroupLayout
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
    LightPass: {
        lightPassPipeline: 'LightPassPipeline',
        lightPassPipelineLayout: 'LightPassPipelineLayout',
        shaderModule: 'LightPassShaderModule',
        DirectLightShadowMap: 'DirectLightShadowMap',
        shadowMapPipeline: 'ShadowMapPipeline',
        shadowMapPipelineLayout: 'ShadowMapPipelineLayout',
        shadowMapShaderModule: 'ShadowMapShaderModule',
    },
    Light: {
        DirectLightBuffer: 'DirectLightBuffer',
        DirectLightShadowMap: 'DirectLightShadowMap'
    },
}
