import { NetworkScene, UbiqTcpConnection, TcpConnectionWrapper, WrappedTcpServer, WrappedSecureWebSocketServer } from '@ucl-vr/ubiq';
import { RoomClient } from '@ucl-vr/ubiq-server/components/roomclient.js';
import { RoomServer, IceServerProvider, Status } from '@ucl-vr/ubiq-server/modules/lib/index.js';
import nconf from 'nconf';
import { Logger } from './logger';
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

    /**
     * Append streaming text to the current output line without repeating the prefix.
     * Call `flushStream()` (or any regular `log()`) to terminate the line.
     */
    logStream(text: string): void {
        Logger.logStream(`\x1b[1m${this.name}\x1b[0m`, text, '\x1b[1m');
    }

    /**
     * End the current streaming log line, if one is active.
     */
    flushStream(): void {
        Logger.flushStream();
    }

    async joinRoom(): Promise<void> {
        let uri = nconf.get('roomserver:uri');
        if (!nconf.get('roomserver:joinExisting')) {
            this.startServer();
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
     * Starts a Ubiq server in-process using the configuration already loaded by nconf.
     *
     * @memberof ApplicationController
     */
    startServer(): void {
        const roomServer = new RoomServer();

        roomServer.addServer(new WrappedTcpServer(nconf.get('roomserver:tcp')));
        roomServer.addServer(new WrappedSecureWebSocketServer(nconf.get('roomserver:wss')));

        new Status(roomServer, nconf.get('status'));

        const iceServerProvider = new IceServerProvider(roomServer);
        const iceServers = nconf.get('iceservers');
        if (iceServers) {
            for (const iceServer of iceServers) {
                iceServerProvider.addIceServer(
                    iceServer.uri, iceServer.secret, iceServer.timeoutSeconds,
                    iceServer.refreshSeconds, iceServer.username, iceServer.password
                );
            }
        }

        process.on('SIGINT', () => {
            roomServer.exit().finally(() => process.exit(0));
        });
    }
}
