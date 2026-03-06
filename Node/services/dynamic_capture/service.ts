import { ServiceController } from '../../components/service';
import { NetworkScene } from 'ubiq';
import path from 'path';
import { fileURLToPath } from 'url';

class DynamicCaptureService extends ServiceController {
    constructor(scene: NetworkScene, name = 'DynamicCapture') {
        super(scene, name);

        // Get __dirname in ES module
        const __dirname = path.dirname(fileURLToPath(import.meta.url));

        // This sample Python file sends a message every 5 seconds.
        this.registerChildProcess('periodic-text-sender', 'python', [
            '-u',
            path.join(__dirname, './Capture.py'),
        ]);
    }
}

export { DynamicCaptureService };
