import { NetworkScene } from 'ubiq-server/ubiq';
import { RoomClient } from 'ubiq-server/components/roomclient.js';
import path from 'path';
import { spawn } from 'child_process';
import nconf from 'nconf';
import { UbiqTcpConnection, TcpConnectionWrapper } from 'ubiq-server/ubiq';
import { Logger } from './logger';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

export class ApplicationController {
    name!: string;
    scene!: NetworkScene;
    roomClient!: RoomClient;
    components!: { [key: string]: any };
    connection!: TcpConnectionWrapper;
    configPath: string;
    heartbeatInterval?: NodeJS.Timeout;
    heartbeatIntervalMs: number;

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

        dotenv.config({ override: true });

        const heartbeatEnvMs = Number(process.env.UBIQ_HEARTBEAT_MS);
        this.heartbeatIntervalMs = Number.isFinite(heartbeatEnvMs) && heartbeatEnvMs > 0 ? heartbeatEnvMs : 5000;
    }

    /**
     * Logs a message to the console with the service name.
     *
     * @memberof ApplicationController
     * @param {string} message - The message to log.
     */
    log(message: string, level: 'info' | 'warning' | 'error' = 'info', end: string = '\n'): void {
        Logger.log(`\x1b[1m${this.name}\x1b[0m`, message, level, end, '\x1b[1m');
    }

    async joinRoom(): Promise<void> {
        let uri = nconf.get('roomserver:uri');
        if (!nconf.get('roomserver:joinExisting')) {
            await this.startServer(this.configPath);
            uri = 'localhost';
        }

        if (!nconf.get('roomserver:uri')) {
            throw new Error(
                'roomserver:uri must be provided to join an existing server (indicated by roomserver:joinExisting)'
            );
        }

        this.connection = UbiqTcpConnection(nconf.get('roomserver:uri'), nconf.get('roomserver:tcp:port'));

        // This may occur immediately if the server address is invalid or unreachable. In this case, check config.json.
        this.connection.onClose.push(() => {
            this.log('Connection to Ubiq server closed.', 'warning');
            this.stopHeartbeat();
        });

        this.scene.addConnection(this.connection);
        this.startHeartbeat();
        this.roomClient.join(nconf.get('roomGuid'));
    }

    /**
     * Starts a heartbeat ping to keep the Ubiq connection alive.
     *
     * @memberof ApplicationController
     */
    private startHeartbeat(): void {
        this.stopHeartbeat();
        const intervalMs = Math.max(1000, this.heartbeatIntervalMs);

        this.log(`Starting heartbeat ping every ${intervalMs} ms to keep the Ubiq connection alive.`);
        this.heartbeatInterval = setInterval(() => {
            try {
                this.roomClient.ping();
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : String(error);
                this.log(`Failed to send heartbeat ping: ${message}`, 'warning');
            }
        }, intervalMs);
    }

    /**
     * Stops the heartbeat ping to keep the Ubiq connection alive.
     *
     * @memberof ApplicationController
     */
    private stopHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = undefined;
        }
    }

    /**
     * Starts a Ubiq server with the specified configuration files.
     *
     * @memberof ApplicationController
     * @param configPath The path to the configuration file to pass to the server
     */
    async startServer(configPath?: string): Promise<void> {
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const ubiqPath = path.resolve(__dirname, '..', 'node_modules', 'ubiq-server');

        var params = ['start'];
        // If configPath is provided, add it to the params
        if (configPath) {
            const absConfigPath = path.resolve(__dirname, configPath);
            params.push(absConfigPath);
        }

        const child = spawn('npm', params, {
            stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
            cwd: ubiqPath,
            shell: true,
        });

        if (child.stderr) {
            child.stderr.on('data', (data) => {
                process.stderr.write(`\x1b[31m[Ubiq Server]\x1b[0m ${data}`);
            });
        }

        if (child.stdout) {
            child.stdout.on('data', (data) => {
                process.stdout.write(`\x1b[32m[Ubiq Server]\x1b[0m ${data}`);
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
