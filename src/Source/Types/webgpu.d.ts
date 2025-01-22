interface GPUTextureDescriptor {
    size: GPUExtent3D;
    format: GPUTextureFormat;
    usage: GPUTextureUsageFlags;
    dimension?: GPUTextureDimension;
    mipLevelCount?: number;
    sampleCount?: number;
    viewFormats?: GPUTextureFormat[];
}

interface GPUTexture {
    createView(descriptor?: GPUTextureViewDescriptor): GPUTextureView;
    destroy(): void;
    width: number;
    height: number;
    depthOrArrayLayers: number;
    mipLevelCount: number;
    sampleCount: number;
    dimension: GPUTextureDimension;
    format: GPUTextureFormat;
    usage: GPUTextureUsageFlags;
}

// ... 其他需要的类型声明 