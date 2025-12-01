import { EventEmitter } from 'node:events';
import { NetworkId } from 'ubiq-server/ubiq';

export class MessageReader extends EventEmitter {
    networkId: NetworkId;
    context: any;

    constructor(scene: any, networkId: number) {
        super();

        if (networkId === undefined) {
            throw new Error(`NetworkId must be defined for service: ${this.constructor.name}`);
        }

        this.networkId = new NetworkId(networkId);
        this.context = scene.register(this);
    }

    // This method is called when a new chunk of data is available to be read. The msg.message is a Buffer object.
    processMessage(msg: { message: Buffer }): void {
        this.emit('data', msg);
    }
}
