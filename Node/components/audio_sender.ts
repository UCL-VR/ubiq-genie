import { NetworkId, NetworkScene } from 'ubiq-server/ubiq';

/** Maximum bytes of raw PCM16 data per network message. */
const MAX_CHUNK_BYTES = 16000;

/** Default sample rate when none is specified. */
const DEFAULT_SAMPLE_RATE = 48000;

/**
 * Encapsulates the AudioInfo + chunked-PCM16 protocol used by Ubiq-Genie
 * to stream audio from the Node server to Unity's InjectableAudioSource.
 *
 * Using this component instead of inline `scene.send` calls ensures that:
 *  - The `sampleRate` field is always included in AudioInfo headers so that
 *    Unity can resample when the device output rate differs.
 *  - The chunked-send loop and header format are consistent across all apps.
 */
export class AudioSender {
    private readonly scene: NetworkScene;
    private readonly networkId: NetworkId;
    private readonly sampleRate: number;

    /**
     * @param scene      The Ubiq NetworkScene to send messages on.
     * @param networkId  The network ID that InjectableAudioSource listens on.
     * @param sampleRate The sample rate of the PCM16 audio that will be sent
     *                   (Hz). This is included in every AudioInfo header so
     *                   Unity can resample if its output rate differs.
     *                   Defaults to 48 000.
     */
    constructor(scene: NetworkScene, networkId: number | NetworkId, sampleRate: number = DEFAULT_SAMPLE_RATE) {
        this.scene = scene;
        this.networkId = typeof networkId === 'number' ? new NetworkId(networkId) : networkId;
        this.sampleRate = sampleRate;
    }

    /**
     * Send a complete audio buffer to Unity using the AudioInfo + chunked-PCM
     * protocol.
     *
     * @param audio   Raw PCM16-LE mono audio bytes at `this.sampleRate`.
     * @param options Optional metadata included in the AudioInfo header.
     */
    send(audio: Buffer, options?: { targetPeer?: string }): void {
        if (audio.length === 0) return;

        // 1. AudioInfo header
        this.scene.send(this.networkId, {
            type: 'AudioInfo',
            targetPeer: options?.targetPeer ?? '',
            audioLength: audio.length.toString(),
            sampleRate: this.sampleRate.toString(),
        });

        // 2. Raw PCM16 data in ≤MAX_CHUNK_BYTES chunks
        let offset = 0;
        while (offset < audio.length) {
            const end = Math.min(offset + MAX_CHUNK_BYTES, audio.length);
            this.scene.send(this.networkId, audio.subarray(offset, end));
            offset = end;
        }
    }
}
