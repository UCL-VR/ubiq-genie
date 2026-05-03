import { ServiceController } from '../../components/service';
import type { ServiceProvider, ProviderRegistry } from '../../components/service';
import { NetworkScene } from '@ucl-vr/ubiq';
import { createStableDiffusionProvider } from './providers/stable_diffusion/provider';

const SERVICE_CONFIG_KEY = 'imageGeneration';

const providers: ProviderRegistry = {
    'stable-diffusion': (config) => createStableDiffusionProvider({
        outputFolder: config.options?.outputFolder as string,
        promptPostfix: config.options?.promptPostfix as string,
    }),
};

class ImageGenerationService extends ServiceController {
    constructor(
        scene: NetworkScene,
        provider?: ServiceProvider,
        options?: { outputFolder?: string; promptPostfix?: string }
    ) {
        const defaultProvider = createStableDiffusionProvider({
            outputFolder: options?.outputFolder ?? '../../apps/texture_generation/data',
            promptPostfix: options?.promptPostfix ?? ', 4k',
        });
        const resolvedProvider = provider ?? ServiceController.resolveProvider(SERVICE_CONFIG_KEY, providers, defaultProvider);
        super(scene, 'ImageGenerationService', resolvedProvider, SERVICE_CONFIG_KEY);
    }
}

export { ImageGenerationService };
