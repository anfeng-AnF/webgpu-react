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
export async function loadTexture(resourceManager, texturePath) {
    // 从指定路径获取图片数据
    const response = await fetch(texturePath);
    if (!response.ok) {
        throw new Error(`Failed to fetch texture at ${texturePath}`);
    }
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);

    // 获取 GPUDevice（假设资源管理器提供 GetDevice() 方法）
    const device = resourceManager.GetDevice();
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
        { source: bitmap },
        { texture: texture },
        [bitmap.width, bitmap.height, 1]
    );

    return texture;
}
