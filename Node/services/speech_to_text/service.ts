import { ServiceController } from '../../components/service';
import type { ServiceProvider, ProviderRegistry } from '../../components/service';
import { NetworkScene } from '@ucl-vr/ubiq';
import { AzureSTTProvider } from './providers/azure/provider';
import { NemotronStreamingSTTProvider } from './providers/nemotron_streaming/provider';

const SERVICE_CONFIG_KEY = 'speechToText';

const providers: ProviderRegistry = {
    'azure': (_config) => AzureSTTProvider,
    'nemotron-streaming': (_config) => NemotronStreamingSTTProvider,
};

class SpeechToTextService extends ServiceController {
    constructor(scene: NetworkScene, provider?: ServiceProvider) {
        const resolvedProvider = provider ?? ServiceController.resolveProvider(SERVICE_CONFIG_KEY, providers, AzureSTTProvider);
        super(scene, 'SpeechToTextService', resolvedProvider, SERVICE_CONFIG_KEY);
    }
}

export { SpeechToTextService };
