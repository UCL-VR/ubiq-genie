import { ServiceController } from '../../components/service';
import type { ServiceProvider } from '../../components/service';
import { NetworkScene } from 'ubiq-server/ubiq';
import { createFastVLMProvider } from './providers/fastvlm/provider';

class VisualQuestionAnsweringService extends ServiceController {
    constructor(scene: NetworkScene, provider?: ServiceProvider) {
        const resolvedProvider = provider ?? createFastVLMProvider();
        super(scene, 'VisualQuestionAnsweringService', resolvedProvider);
    }
}

export { VisualQuestionAnsweringService };
