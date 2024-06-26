import { NetworkScene } from 'ubiq';
import { RoomClient } from 'ubiq-server/components/roomclient.js';
import path from 'path';
import { spawn } from 'child_process';
import nconf from 'nconf';
import { UbiqTcpConnection } from 'ubiq-server/ubiq';

class ApplicationController {
    name!: string;
    scene!: NetworkScene;
    roomClient!: RoomClient;
    components!: { [key: string]: any };
    connection!: any;
    configPath: string;

    /**
     * Constructor for the ApplicationController class.
     *
     * @constructor
     * @memberof ApplicationController
     * @param {object} config - The configuration object.
    */
    constructor(configPath: string) {
        this.components = {}; // A dictionary of services used by the application
        nconf.file(configPath);

        this.scene = new NetworkScene();
        this.roomClient = new RoomClient(this.scene);

        this.configPath = configPath;
        this.name = nconf.get('name');
    }

    /**
     * Logs a message to the console with the service name.
     * 
     * @memberof ApplicationController
     * @param {string} message - The message to log.
     */
    log(message: string, end: string = '\n'): void {
        process.stdout.write(`\x1b[1m${this.name}\x1b[0m: ${message}` + end);
    }

    async joinRoom(): Promise<void> {
        let uri = nconf.get("roomserver:uri");
        if (!nconf.get("roomserver:joinExisting")) {
            await this.startServer(this.configPath);
            uri = "localhost";
        }

        if (!nconf.get("roomserver:uri")) {
            throw new Error("roomserver:uri must be provided to join an existing server (indicated by roomserver:joinExisting)");
        }

        this.connection = UbiqTcpConnection(nconf.get("roomserver:uri"), nconf.get("roomserver:tcp"));
        this.scene.addConnection(this.connection);
        this.roomClient.join(nconf.get("roomGuid"));
    }

    /**
     * Starts a Ubiq server with the specified configuration files.
     * 
     * @memberof ApplicationController
     * @param configFiles An array of configuration files to pass to the server
     */
    async startServer(configPath?: string): Promise<void> {
        const __dirname = path.dirname(new URL(import.meta.url).pathname);
        const ubiqPath = path.resolve(__dirname, '..', 'node_modules', 'ubiq-server');

        var params = ["start"];
        // If configPath is provided, add it to the params
        if (configPath) {
            const absConfigPath = path.resolve(__dirname, configPath);
            params.push(absConfigPath);
        }

        const child = spawn('npm', params, {
            stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
            cwd: ubiqPath,
        });

        if (child.stderr) {
            child.stderr.on('data', (data) => {
                process.stderr.write(`\x1b[31mUbiq server error\x1b[0m: ${data}`);
            });
        }

        if (child.stdout) {
            child.stdout.on('data', (data) => {
                process.stdout.write(`\x1b[32mUbiq server output\x1b[0m: ${data}`);
            });
        }

        // Wait for the child process to print "Added RoomServer port" before returning
        return new Promise<void>((resolve) => {
            child.stdout?.on('data', (data) => {
                if (data.toString().includes('Added RoomServer port')) {
                    resolve();
                }
            });
        });
    }
}

export { ApplicationController };
