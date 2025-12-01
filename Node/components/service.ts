import { EventEmitter } from 'node:events';
import { spawn, ChildProcess } from 'child_process';
import { NetworkScene } from 'ubiq-server/ubiq';
import { Logger } from './logger';
import { RoomClient } from 'ubiq-server/components/roomclient';

class ServiceController extends EventEmitter {
    name: string;
    config: any;
    roomClient: RoomClient;
    childProcesses: { [identifier: string]: ChildProcess };

    /**
     * Constructor for the Service class.
     *
     * @constructor
     * @param {NetworkScene} scene - The NetworkScene in which the service should be registered.
     * @param {string} name - The name of the service.
     * @param {object} config - An object containing configuration information for the service.
     */
    constructor(scene: NetworkScene, name: string) {
        super();
        this.name = name;
        this.roomClient = scene.getComponent('RoomClient') as RoomClient;
        this.childProcesses = {};

        // Listen for process exit events and ensure child processes are killed
        process.on('exit', () => this.killAllChildProcesses());
        process.on('SIGINT', () => {
            this.killAllChildProcesses();
            process.exit();
        });
        process.on('SIGTERM', () => {
            this.killAllChildProcesses();
            process.exit();
        });
    }

    /**
     * Method to register a child process. This method registers the child process with the existing OnResponse and OnError callbacks.
     *
     * @memberof Service
     * @instance
     * @param {string} identifier - The identifier for the child process. This should be unique for each child process.
     * @param {string} command - The command to execute. E.g. "python".
     * @param {Array<string>} options - The options to pass to the command.
     * @throws {Error} If identifier is undefined or if the child process fails to spawn.
     * @returns {ChildProcess} The spawned child process.
     */
    registerChildProcess(identifier: string, command: string, options: Array<string>): ChildProcess {
        if (identifier === undefined) {
            throw new Error(`Identifier must be defined for child process of service: ${this.name}`);
        }
        if (this.childProcesses[identifier] !== undefined) {
            throw new Error(`Identifier: ${identifier} already in use for child process of service: ${this.name}`);
        }

        try {
            this.childProcesses[identifier] = spawn(command, options);
        } catch (e) {
            throw new Error(`Failed to spawn child process for service: ${this.name}. Error: ${e}`);
        }

        // Register events for the child process.
        const childProcess = this.childProcesses[identifier];
        if (childProcess && childProcess.stdout && childProcess.stderr) {
            childProcess.stdout.on('data', (data) => this.emit('data', data, identifier));
            childProcess.stderr.on('data', (data) => {
                console.error(`\x1b[31mService ${this.name} error, from child process ${identifier}:${data}\x1b[0m`);
            });
            childProcess.on('close', (code, signal) => {
                delete this.childProcesses[identifier];
                this.emit('close', code, signal, identifier);
            });
        }

        this.log(`Registered child process with identifier: ${identifier}`);

        // Check if the child process has already been closed.
        if (this.childProcesses[identifier].killed) {
            delete this.childProcesses[identifier];
            this.emit('close', 0, 'SIGTERM', identifier);
        }

        // Return reference to the child process.
        return this.childProcesses[identifier];
    }

    /**
     * Logs a message to the console with the service name.
     *
     * @memberof ServiceController
     * @param {string} message - The message to log.
     */
    log(message: string, level: 'info' | 'warning' | 'error' = 'info', end: string = '\n'): void {
        Logger.log(this.name, message, level, end, '\x1b[35m');
    }

    /**
     * Sends data to a child process with the specified identifier.
     *
     * @memberof Service
     * @param {string} data - The data to send to the child process.
     * @param {string} identifier - The identifier of the child process to send the data to.
     * @instance
     * @throws {Error} Throws an error if the child process with the specified identifier is not found.
     */
    sendToChildProcess(identifier: string, data: string | Buffer) {
        if (this.childProcesses[identifier] === undefined) {
            this.log(`Child process with identifier ${identifier} not found for service: ${this.name}`, 'error');
            return;
        }

        this.childProcesses[identifier].stdin!.write(data);
    }

    /**
     * Method to kill a specific child process.
     *
     * @memberof Service
     * @param {string} identifier - The identifier for the child process to kill.
     * @instance
     */
    killChildProcess(identifier: string) {
        if (this.childProcesses[identifier] === undefined) {
            throw new Error(`Child process with identifier: ${identifier} not found for service: ${this.name}`);
        }

        this.childProcesses[identifier].kill();
        delete this.childProcesses[identifier];
    }

    /**
     * Method to kill all child processes.
     *
     * @memberof Service
     * @instance
     */
    killAllChildProcesses() {
        this.log('Killing all child processes');
        for (const childProcess of Object.values(this.childProcesses)) {
            childProcess.kill();
        }
    }
}

export { ServiceController };
