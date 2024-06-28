import express, { Express } from 'express';
import http from 'http';

export class FileServer {
    private directory: string;
    private port: number;
    private prefix: string;
    private app: Express;
    private server?: http.Server;

    constructor(directory: string = 'files', port: number = 3000, prefix: string = '/') {
        this.directory = directory;
        this.port = port;
        this.prefix = prefix;
        this.app = express();
        this.start();
    }

    start() {
        this.app.use(this.prefix, express.static(this.directory));
        this.server = this.app.listen(this.port, () => {
            console.log(`File server listening on port ${this.port} and serving files from ${this.directory}!`);
        });
    }

    stop() {
        this.server?.close();
    }
}
