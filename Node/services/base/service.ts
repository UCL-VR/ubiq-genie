import { ServiceController } from '../../components/service';
import type { ServiceProvider, ProviderRegistry } from '../../components/service';
import { NetworkScene } from 'ubiq-server/ubiq';
import { IntervalPrinterProvider } from './providers/interval_printer/provider';

const SERVICE_CONFIG_KEY = 'base';

const providers: ProviderRegistry = {
    'interval-printer': () => IntervalPrinterProvider,
};

class BaseService extends ServiceController {
    constructor(scene: NetworkScene, provider?: ServiceProvider) {
        const resolvedProvider = provider ?? ServiceController.resolveProvider(SERVICE_CONFIG_KEY, providers, IntervalPrinterProvider);
        super(scene, 'BaseService', resolvedProvider, SERVICE_CONFIG_KEY);
    }
}

export { BaseService };
