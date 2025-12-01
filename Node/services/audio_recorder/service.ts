import { ServiceController } from '../../components/service';
import { NetworkScene } from 'ubiq-server/ubiq';
import nconf from 'nconf';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

class AudioRecorder extends ServiceController {
    file_path_prefix: string;
    constructor(
        scene: NetworkScene,
        name = 'AudioRecorder',
        file_path_prefix: string = './recordings/recorded_audio_'
    ) {
        super(scene, name);
        this.file_path_prefix = file_path_prefix;

        // If file_path_prefix contains directories, create them if they don't exist
        const directory = path.dirname(file_path_prefix);
        fs.mkdirSync(directory, { recursive: true });

        this.registerRoomClientEvents();
    }

    // Register events to create a recording process for each peer. These processes are killed when the peer leaves the room.
    registerRoomClientEvents(): void {
        if (this.roomClient === undefined) {
            throw new Error('RoomClient must be added to the scene before AudioCollector');
        }

        this.roomClient.addListener('OnPeerAdded', (peer: { uuid: string }) => {
            this.log('Starting recording process for peer ' + peer.uuid);
            // File path based on peer UUID and timestamp
            const timestamp = new Date().toISOString().replace(/:/g, '-');
            const file_path = this.file_path_prefix + peer.uuid + '_' + timestamp + '.wav';

            this.registerChildProcess(peer.uuid, 'python', [
                '-u',
                path.join(path.dirname(fileURLToPath(import.meta.url)), 'record.py'),
                '--file_path',
                file_path,
            ]);
        });

        this.roomClient.addListener('OnPeerRemoved', (peer: { uuid: string }) => {
            this.log('Ending recording process for peer ' + peer.uuid);
            this.killChildProcess(peer.uuid);
        });
    }
}

export { AudioRecorder };
