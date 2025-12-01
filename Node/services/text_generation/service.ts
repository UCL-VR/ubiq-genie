import { ServiceController } from '../../components/service';
import { NetworkScene } from 'ubiq-server/ubiq';
import nconf from 'nconf';

class TextGenerationService extends ServiceController {
    constructor(scene: NetworkScene) {
        super(scene, 'TextGenerationService');
        console.log('preprompt', nconf.get('preprompt'), 'prompt_suffix', nconf.get('prompt_suffix'));

        this.registerChildProcess('default', 'python', [
            '-u',
            '../../services/text_generation/openai_chatgpt.py',
            '--preprompt',
            nconf.get('preprompt') || '',
            '--prompt_suffix',
            nconf.get('prompt_suffix') || '',
        ]);
    }
}

export { TextGenerationService };
