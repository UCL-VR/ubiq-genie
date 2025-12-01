import fs from 'fs';
import { ServiceController } from '../../components/service';
import { NetworkScene } from 'ubiq-server/ubiq';
import nconf from 'nconf';
import path from 'path';
import { fileURLToPath } from 'url';

class SpeechToTextService extends ServiceController {
    constructor(scene: NetworkScene, name = 'SpeechToTextService') {
        super(scene, name);

        this.registerRoomClientEvents();
    }

    // Register events to create a transcription process for each peer. These processes are killed when the peer leaves the room.
    registerRoomClientEvents(): void {
        if (this.roomClient === undefined) {
            throw new Error('RoomClient must be added to the scene before AudioCollector');
        }

        this.roomClient.addListener('OnPeerAdded', (peer: { uuid: string }) => {
            this.log('Starting speech-to-text process for peer ' + peer.uuid);

            this.registerChildProcess(peer.uuid, 'python', [
                '-u',
                path.join(path.dirname(fileURLToPath(import.meta.url)), 'transcribe_azure.py'),
            ]);
        });

        this.roomClient.addListener('OnPeerRemoved', (peer: { uuid: string }) => {
            this.log('Ending speech-to-text process for peer ' + peer.uuid);
            this.killChildProcess(peer.uuid);
        });
    }
}

export { SpeechToTextService };
