/**
 * Abstract Class Service.
 *
 * @class Service
 */

const { EventEmitter } = require("stream");
const { NetworkId } = require("ubiq/ubiq/messaging");

const spawn = require("child_process").spawn;

class ServiceController extends EventEmitter {
    /**
     * Constructor for the Service class.
     *
     * @constructor
     * @param {NetworkScene} scene - The NetworkScene in which the service should be registered.
     * @param {int} networkId - The NetworkId that should be used for the service. This should be unique for each service and should not be one of the reserved NetworkIds.
     * @param {string} name - The name of the service.
     * @param {bool} sendResponseToPeers - Whether the response should be broadcast to all peers in the room.
     * @throws {Error} If networkId is undefined.
     */
    constructor(scene, name, config = {}) {
        super();
        this.name = name;
        this.config = config;

        this.roomClient = scene.getComponent("RoomClient");
        this.childProcesses = {};
    }

    /**
     * Method to register a child process. This method registers the child process with the existing OnResponse and OnError callbacks.
     *
     * @memberof Service
     * @instance
     * @param {string} identifier - The identifier for the child process. This should be unique for each child process.
     * @param {string} command - The command to execute. E.g. "python".
     * @param {Array<string>} options - The options to pass to the command.
     * @throws {Error} If identifier is undefined or if the child process fails to spawn.\
     * @returns {ChildProcess} The spawned child process.
     */
    registerChildProcess(identifier, command, options) {
        if (identifier == undefined) {
            throw new Error(`Identifier must be defined for child process of service: ${this.name}`);
        }
        if (this.childProcesses[identifier] != undefined) {
            throw new Error(`Identifier: ${identifier} already in use for child process of service: ${this.name}`);
        }

        try {
            this.childProcesses[identifier] = spawn(command, options);
        } catch (e) {
            throw new Error(`Failed to spawn child process for service: ${this.name}. Error: ${e}`);
        }

        // Register events for the child process.
        this.childProcesses[identifier].stdout.on("data", (data) => this.emit("response", data, identifier));
        this.childProcesses[identifier].stderr.on("data", (data) => {
            console.error(`\x1b[31mService ${this.name} error, from child process ${identifier}:${data}\x1b[0m`);
        });
        this.childProcesses[identifier].on("close", (code, signal) => {
            delete this.childProcesses[identifier];
            this.emit("close", code, signal, identifier);
        });

        console.log(`\x1b[35mService ${this.name}: \x1b[0m Registered child process with identifier: ${identifier}`);

        // Check if the child process has already been closed.
        if (this.childProcesses[identifier].killed) {
            delete this.childProcesses[identifier];
            this.emit("close", 0, "SIGTERM", identifier);
        }

        // Return reference to the child process.
        return this.childProcesses[identifier];
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
    sendToChildProcess(identifier, data) {
        if (this.childProcesses[identifier] == undefined) {
            throw new Error(`\x1b[31mService ${this.name} error\x1b[0m: Child process with identifier: ${identifier}`);
        }

        this.childProcesses[identifier].stdin.write(data);
    }

    /**
     * Method to kill a specific child processes.
     *
     * @memberof Service
     * @param {string} identifier - The identifier for the child process to kill.
     * @instance
     */
    killChildProcess(identifier) {
        if (this.childProcesses[identifier] == undefined) {
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
        for (const childProcess of Object.values(this.childProcesses)) {
            childProcess.kill();
        }
    }
}

module.exports = {
    ServiceController,
};
