import InitDefaultPipeline from '../Renderer/InitResource/DeferredRendering/InitDefaultPipeline';

export class FSceneRenderer {
    constructor(device) {
        this.device = device;
    }

    Initialize() {
        InitDefaultPipeline.InitializeDeferredRenderPipeline();
    }


    Render() {

    }
}
