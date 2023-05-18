const { NetworkScene, UbiqTcpConnection } = require("ubiq/ubiq");
const { RoomClient } = require("ubiq/components");
const fs = require("fs");
const nconf = require("nconf");
const path = require("path");
const { spawn } = require("child_process");

class ApplicationController {
    constructor(configFilePath = "./config.json") {
        nconf.file(configFilePath);
        this.configFilePath = configFilePath;
        this.name = nconf.get("name");
        this.scene = new NetworkScene();
        this.roomClient = new RoomClient(this.scene);
        this.components = {}; // A dictionary of services used by the application
    }

    start() {
        // STEP 1: Register services (and any other components) used by the application
        this.registerComponents();
        console.log(`\x1b[1m${this.name}\x1b[0m: services registered: ${Object.keys(this.components).join(", ")}`);

        // STEP 2: Define the application pipeline
        this.definePipeline();
        console.log(`\x1b[1m${this.name}\x1b[0m: pipeline defined`)

        // STEP 3: Start a Ubiq server and connect to a room
        this.startServer([this.configFilePath]).then(() => {
            // STEP 4: Join a room with the specified roomGuid
            this.connection = UbiqTcpConnection("localhost", nconf.get("roomserver:tcp"));
            this.scene.addConnection(this.connection);
            this.roomClient.join(nconf.get("roomGuid"));
        });
    }

    // Register services
    registerComponents() {
        throw new Error("Method `registerComponents` must be defined in application-specific subclass.");
    }

    // Define the application pipeline
    definePipeline() {
        throw new Error("Method `definePipeline` must be defined in application-specific subclass.");
    }

    // Start a Ubiq server
    async startServer(args = [ "config.json" ]) {
        if (!fs.existsSync(path.join(__dirname, "../node_modules/ubiq/app.js"))) {
            throw new Error("`ubiq` npm package not found. Please run 'npm install' in the root directory.");
        }
    
        // Start child process and include any parameters from this function to the spawn call
        const child = spawn("node", [path.join(__dirname, "../node_modules/ubiq/app.js").toString()].concat(args));
    
        // Write any outputs from child to the parent process (in cyan)
        child.stdout.on("data", (data) => {
            process.stdout.write(`\x1b[36mUbiq server\x1b[0m: ${data}`);
        });
    
        // Write any errors from child to the parent process
        child.stderr.on("data", (data) => {
            process.stderr.write(`\x1b[31mUbiq server error\x1b[0m: ${data}`);
        });
    
        // Wait for the child process to print "Added RoomServer port" before returning
        await new Promise((resolve) => {
            child.stdout.on("data", (data) => {
                if (data.includes("Added RoomServer port")) {
                    resolve();
                }
            });
        });
    }
}

module.exports = {
    ApplicationController
};