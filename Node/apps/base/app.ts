import { ApplicationController } from '../../components/application';
import { BaseService } from '../../services/base/service';
import path from 'path';
import { NetworkId } from 'ubiq-server/ubiq';
import { fileURLToPath } from 'url';

class BaseApplication extends ApplicationController {
    constructor(configPath: string) {
        super(configPath);
    }

    start(): void {
        // STEP 1: Register services (and any other components) used by the application
        this.registerComponents();
        this.log(`Services registered: ${Object.keys(this.components).join(', ')}`);

        // STEP 2: Define the application pipeline
        this.definePipeline();
        this.log('Pipeline defined');

        // STEP 3: Join a room based on the configuration (optionally creates a server)
        this.joinRoom();
    }

    registerComponents(): void {
        // A MessageReader to read audio data from peers based on fixed network ID
        this.components.intervalPrinter = new BaseService(this.scene);
    }

    definePipeline(): void {
        // When we receive a message from the child process, log  it
        // this.components.intervalPrinter.on('data', (data: string) => {
        //     this.log(`Child process sent message: ${data}`);
        // });

        // After processing the message, we may send it to the Unity client based on a (predefined) network ID
        // For example, with fixed network ID 99:
        this.components.intervalPrinter.on('data', (data: string) => {
            // Log the message for debugging purposes
            this.log(`Child process sent message: ${data}`);

            this.scene.send(new NetworkId(99), {
                data: data.toString(),
            });
        });
    }
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    const configPath = './config.json';
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const absConfigPath = path.resolve(__dirname, configPath);
    const app = new BaseApplication(absConfigPath);
    app.start();
}

export { BaseApplication };
