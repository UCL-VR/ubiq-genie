import { NetworkId, NetworkScene } from '@ucl-vr/ubiq';

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
     * protocol. Sends an AudioInfo header followed by the raw data chunks.
     *
     * Best for **one-shot** audio (e.g. TTS responses) where each call
     * represents a discrete utterance. For continuous streaming (e.g.
     * audio-to-audio), use `sendHeader()` once and then `sendChunks()` for
     * each frame to avoid Unity clearing its playback queue on every header.
     *
     * @param audio   Raw PCM16-LE mono audio bytes at `this.sampleRate`.
     * @param options Optional metadata included in the AudioInfo header.
     */
    send(audio: Buffer, options?: { targetPeer?: string }): void {
        if (audio.length === 0) return;
        this.sendHeader({ ...options, audioLength: audio.length });
        this.sendChunks(audio);
    }

    /**
     * Send only the AudioInfo header (no audio data).
     *
     * Use this once at the start of a continuous stream, then call
     * `sendChunks()` for each audio frame. This avoids the queue-clearing
     * side-effect of `dropOnNewSequence` on the Unity side.
     */
    sendHeader(options?: { targetPeer?: string; audioLength?: number }): void {
        this.scene.send(this.networkId, {
            type: 'AudioInfo',
            targetPeer: options?.targetPeer ?? '',
            audioLength: (options?.audioLength ?? 0).toString(),
            sampleRate: this.sampleRate.toString(),
        });
    }

    /**
     * Send raw PCM16 data chunks without an AudioInfo header.
     *
     * Each chunk is at most MAX_CHUNK_BYTES. Unity's InjectableAudioSource
     * treats messages ≥ 200 bytes that are not valid JSON as raw PCM audio,
     * so no preceding AudioInfo is needed for the data to be played.
     */
    sendChunks(audio: Buffer): void {
        if (audio.length === 0) return;
        let offset = 0;
        while (offset < audio.length) {
            const end = Math.min(offset + MAX_CHUNK_BYTES, audio.length);
            this.scene.send(this.networkId, audio.subarray(offset, end));
            offset = end;
        }
    }
}
