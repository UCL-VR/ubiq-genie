// Simple class that serves files from a directory using express.
//
// Usage:
// const { FileServer } = require("./file_server");
// const server = new FileServer();
// server.start();
//
// // To serve files from a different directory:
// const server = new FileServer("public");
// server.start();
//
// // To serve files from a different directory and on a different port:
// const server = new FileServer("public", 3000);
// server.start();
//
// // To serve files from a different directory and on a different port and with a different prefix:
// const server = new FileServer("public", 3000, "/images");
// server.start();

const express = require("express");

class FileServer {
    constructor(directory = "files", port = 3000, prefix = "/") {
        this.directory = directory;
        this.port = port;
        this.prefix = prefix;
        this.app = express();
        this.start();
    }

    start() {
        this.app.use(this.prefix, express.static(this.directory));
        this.app.listen(this.port, () => {
            console.log(`File server listening on port ${this.port} and serving files from ${this.directory}!`);
        });
    }

    stop() {
        this.app.close();
    }
}

module.exports = {
    FileServer,
};
