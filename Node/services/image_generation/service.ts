import { ServiceController } from '../../components/service';
import { NetworkScene } from 'ubiq-server/ubiq';

class ImageGenerationService extends ServiceController {
    constructor(scene: NetworkScene) {
        super(scene, 'ImageGenerationService');
        this.registerRoomClientEvents();
    }

    // Register events to start the child process when the first peer joins the room, and to kill the child process when the last peer leaves the room.
    registerRoomClientEvents() {
        if (this.roomClient == undefined) {
            throw new Error('RoomClient must be added to the scene before ImageGenerationService');
        }

        this.roomClient.addListener('OnPeerAdded', (peer: any) => {
            if (!('default' in this.childProcesses)) {
                this.registerChildProcess('default', 'python', [
                    '-u',
                    '../../services/image_generation/text_2_image.py',
                    '--output_folder',
                    '../../apps/texture_generation/data',
                    '--prompt_postfix',
                    ', 4k',
                ]);
            }
        });

        this.roomClient.addListener('OnPeerRemoved', (peer: any) => {
            if (this.roomClient.peers.size == 0) {
                this.killChildProcess('default');
            }
        });
    }
}

export { ImageGenerationService };
