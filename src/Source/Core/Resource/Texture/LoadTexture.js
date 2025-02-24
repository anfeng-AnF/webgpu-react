import GenerateMipmapPass from '../../../Renderer/DeferredShadingRenderer/Pass/ComputePass/GenerateMipmapPass';
/**
 * 加载指定路径的纹理，并上传至 GPU。
 *
 * 此方法使用传入的资源管理器中的 GPUDevice 创建 GPU 纹理，
 * 并利用 WebGPU 的 copyExternalImageToTexture 方法将图片数据复制到纹理中。
 *
 * @param {FResourceManager} resourceManager - 资源管理器实例（必须包含 GPUDevice）
 * @param {string} texturePath - 纹理图片的路径（URL 或相对路径）
 * @returns {Promise<GPUTexture>} 返回创建好的 GPU 纹理
 */
export async function loadTexture(resourceManager, texturePath, needFlipy = false) {
    // 从指定路径获取图片数据
    const response = await fetch(texturePath);
    if (!response.ok) {
        throw new Error(`Failed to fetch texture at ${texturePath}`);
    }
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);

    // 获取 GPUDevice（假设资源管理器提供 GetDevice() 方法）
    const device = await resourceManager.GetDevice();
    if (!device) {
        throw new Error("GPU Device not available in resource manager");
    }

    // 定义纹理描述符，根据图片尺寸设定纹理大小
    const textureDesc = {
        size: [bitmap.width, bitmap.height, 1],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    };

    // 使用资源管理器创建纹理
    // 这里使用 texturePath 作为唯一名称
    const texture = resourceManager.CreateResource(texturePath, {
        Type: 'Texture', // 或者使用 EResourceType.Texture，如果在项目中有定义该枚举
        desc: textureDesc,
        Metadata: { source: texturePath }
    });

    // 将图片数据复制到纹理
    device.queue.copyExternalImageToTexture(
        { source: bitmap, flipY: needFlipy },
        { texture: texture },
        [bitmap.width, bitmap.height, 1]
    );

    return texture;
}

/**
 * 加载HDR环境贴图
 * @param {FResourceManager} resourceManager - 资源管理器实例
 * @param {string} hdrPath - HDR文件路径
 * @returns {Promise<GPUTexture>} 返回创建好的GPU纹理
 */
export async function loadHDRTexture(resourceManager, hdrPath) {
    // 导入THREE.js的HDR加载器和相关类
    const { RGBELoader } = await import('three/examples/jsm/loaders/RGBELoader.js');
    const { FloatType, LinearFilter, LinearSRGBColorSpace } = await import('three');
    
    // 加载HDR贴图
    const loader = new RGBELoader().setDataType(FloatType);
    const hdrTexture = await new Promise((resolve, reject) => {
        loader.load(hdrPath, 
            (texture) => {
                texture.minFilter = LinearFilter;
                texture.magFilter = LinearFilter;
                texture.colorSpace = LinearSRGBColorSpace;
                resolve(texture);
            },
            undefined,
            reject
        );
    });

    // 获取GPU设备并创建纹理
    const device = await resourceManager.GetDevice();
    if (!device) {
        throw new Error("GPU Device not available in resource manager");
    }

    // 计算mipmap级别
    const mipLevelCount = Math.floor(Math.log2(Math.max(hdrTexture.image.width, hdrTexture.image.height))) + 1;

    // 创建GPU纹理
    const gpuTexture = resourceManager.CreateResource(hdrPath, {
        Type: 'Texture',
        desc: {
            size: [hdrTexture.image.width, hdrTexture.image.height, 1],
            format: 'rgba32float',
            usage: GPUTextureUsage.TEXTURE_BINDING | 
                   GPUTextureUsage.COPY_DST | 
                   GPUTextureUsage.STORAGE_BINDING,
            dimension: '2d',
            mipLevelCount: mipLevelCount,  // 添加mipmap级别
            viewFormats: ['rgba32float']
        },
        Metadata: { source: hdrPath, type: 'HDR' }
    });

    // 上传数据到GPU
    const bytesPerRow = hdrTexture.image.width * 16;
    const uploadBuffer = device.createBuffer({
        size: bytesPerRow * hdrTexture.image.height,
        usage: GPUBufferUsage.COPY_SRC,
        mappedAtCreation: true,
    });

    new Float32Array(uploadBuffer.getMappedRange()).set(hdrTexture.image.data);
    uploadBuffer.unmap();

    // 复制数据到纹理
    const copyEncoder = device.createCommandEncoder();
    copyEncoder.copyBufferToTexture(
        {
            buffer: uploadBuffer,
            bytesPerRow,
            rowsPerImage: hdrTexture.image.height,
        },
        { texture: gpuTexture },
        [hdrTexture.image.width, hdrTexture.image.height, 1]
    );

    // 提交命令
    device.queue.submit([copyEncoder.finish()]);
    uploadBuffer.destroy();

    // 生成mipmap
    const mipmapPass = new GenerateMipmapPass();
    await mipmapPass.Initialize();
    mipmapPass.setSourceTexture(gpuTexture);
    
    const mipmapEncoder = device.createCommandEncoder();
    await mipmapPass.Render(0, null, mipmapEncoder);
    device.queue.submit([mipmapEncoder.finish()]);

    return gpuTexture;
}

