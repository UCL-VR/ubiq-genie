import { ServiceController } from '../../components/service';
import type { ServiceProvider, ProviderRegistry } from '../../components/service';
import { NetworkScene } from '@ucl-vr/ubiq';
import { createFastVLMProvider } from './providers/fastvlm/provider';

const SERVICE_CONFIG_KEY = 'visualQuestionAnswering';

const providers: ProviderRegistry = {
    'fastvlm': (config) => createFastVLMProvider({
        modelPath: config.model,
        ...(config.options as any),
    }),
};

class VisualQuestionAnsweringService extends ServiceController {
    constructor(scene: NetworkScene, provider?: ServiceProvider) {
        const resolvedProvider = provider ?? ServiceController.resolveProvider(SERVICE_CONFIG_KEY, providers, createFastVLMProvider());
        super(scene, 'VisualQuestionAnsweringService', resolvedProvider, SERVICE_CONFIG_KEY);
    }
}

export { VisualQuestionAnsweringService };
