import { ServiceController } from '../../components/service';
import type { ServiceProvider, ProviderRegistry } from '../../components/service';
import { NetworkScene } from '@ucl-vr/ubiq';
import nconf from 'nconf';
import { createOpenAIProvider } from './providers/openai/provider';
import { createHuggingFaceProvider } from './providers/huggingface/provider';
import { createLlamaCppProvider } from './providers/llama_cpp/provider';
import { createOllamaProvider } from './providers/ollama/provider';

const SERVICE_CONFIG_KEY = 'textGeneration';

const providers: ProviderRegistry = {
    'openai': (config) => createOpenAIProvider({
        preprompt: (config.options?.preprompt as string) ?? nconf.get('preprompt') ?? '',
        promptSuffix: (config.options?.promptSuffix as string) ?? nconf.get('prompt_suffix') ?? '',
    }),
    'huggingface': (config) => createHuggingFaceProvider(config),
    'llama-cpp': (config) => createLlamaCppProvider(config),
    'ollama': (config) => createOllamaProvider(config),
};

class TextGenerationService extends ServiceController {
    constructor(scene: NetworkScene, provider?: ServiceProvider) {
        const defaultProvider = createOpenAIProvider({
            preprompt: nconf.get('preprompt') || '',
            promptSuffix: nconf.get('prompt_suffix') || '',
        });
        const resolvedProvider = provider ?? ServiceController.resolveProvider(SERVICE_CONFIG_KEY, providers, defaultProvider);
        super(scene, 'TextGenerationService', resolvedProvider, SERVICE_CONFIG_KEY);
    }
}

export { TextGenerationService };
