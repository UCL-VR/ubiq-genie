import { ServiceController } from '../../components/service';
import { NetworkScene } from 'ubiq-server/ubiq';
import path from 'path';
import { fileURLToPath } from 'url';

class BaseService extends ServiceController {
    constructor(scene: NetworkScene, name = 'BaseService') {
        super(scene, name);

        // Get __dirname in ES module
        const __dirname = path.dirname(fileURLToPath(import.meta.url));

        // This sample Python file sends a message every 5 seconds.
        this.registerChildProcess('periodic-text-sender', 'python', [
            '-u',
            path.join(__dirname, './interval_text_printer.py'),
        ]);
    }
}

export { BaseService };
