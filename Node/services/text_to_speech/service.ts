import { ServiceController } from '../../components/service';
import { NetworkScene } from 'ubiq-server/ubiq';
import nconf from 'nconf';

export class TextToSpeechService extends ServiceController {
    constructor(scene: NetworkScene) {
        super(scene, 'TextToSpeechService');

        this.registerChildProcess('default', 'python', ['-u', '../../services/text_to_speech/text_to_speech_azure.py']);
    }
}
