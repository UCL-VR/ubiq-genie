import { ServiceController } from '../../components/service';
import type { ServiceProvider, ProviderRegistry } from '../../components/service';
import { NetworkScene } from 'ubiq-server/ubiq';
import { AzureTTSProvider } from './providers/azure/provider';
import { KokoroTTSProvider } from './providers/kokoro/provider';

const SERVICE_CONFIG_KEY = 'textToSpeech';

const providers: ProviderRegistry = {
    'azure': () => AzureTTSProvider,
    'kokoro': () => KokoroTTSProvider,
};

export class TextToSpeechService extends ServiceController {
    constructor(scene: NetworkScene, provider?: ServiceProvider) {
        const resolvedProvider = provider ?? ServiceController.resolveProvider(SERVICE_CONFIG_KEY, providers, AzureTTSProvider);
        super(scene, 'TextToSpeechService', resolvedProvider, SERVICE_CONFIG_KEY);
    }
}
