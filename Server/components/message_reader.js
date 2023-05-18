const { EventEmitter } = require('stream');
const { NetworkId } = require("ubiq/ubiq");

class MessageReader extends EventEmitter {
    constructor(scene, networkId) {
        super();

        if (networkId == undefined) {
            throw new Error(`NetworkId must be defined for service: ${this.name}`);
        }
        
        this.networkId = new NetworkId(networkId);
        this.context = scene.register(this);
    }

    // This method is called when a new chunk of data is available to be read. The msg.message is a Buffer object.
    processMessage(msg) {
        this.emit('data', msg);
    }
}

module.exports = { MessageReader }