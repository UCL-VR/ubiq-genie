import { ServiceController } from '../../components/service';
import { NetworkScene } from 'ubiq';
import path from 'path';

class BaseService extends ServiceController {
    constructor(scene: NetworkScene, name = 'BaseService') {
        super(scene, name);

        // Get __dirname in ES module
        const __dirname = path.dirname(new URL(import.meta.url).pathname);

        // This sample Python file sends a message every 5 seconds.
        this.registerChildProcess('periodic-text-sender', 'python', [
            '-u',
            path.join(__dirname, './interval_text_printer.py'),
        ]);
    }
}

export { BaseService };
