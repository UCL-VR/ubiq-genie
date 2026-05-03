import { ServiceController } from '../../components/service';
import { NetworkScene } from '@ucl-vr/ubiq';
import path from 'path';
import fs from 'fs';

/**
 * Manages an open WAV file for a single peer. Writes a placeholder header on
 * creation, appends raw PCM data via `write()`, and patches the header with
 * correct sizes on `finalize()`.
 *
 * Audio format: 48 kHz, 16-bit, mono (matching Ubiq WebRTC audio).
 */
class WavWriter {
    private fd: number;
    private dataBytes = 0;

    private static readonly SAMPLE_RATE = 48000;
    private static readonly BIT_DEPTH = 16;
    private static readonly CHANNELS = 1;

    constructor(filePath: string) {
        this.fd = fs.openSync(filePath, 'w');
        this.writeHeader();
    }

    /** Writes a 44-byte RIFF/WAV header with placeholder sizes (updated on finalize). */
    private writeHeader() {
        const header = Buffer.alloc(44);
        const byteRate =
            WavWriter.SAMPLE_RATE * WavWriter.CHANNELS * (WavWriter.BIT_DEPTH / 8);
        const blockAlign = WavWriter.CHANNELS * (WavWriter.BIT_DEPTH / 8);

        // RIFF chunk descriptor
        header.write('RIFF', 0);
        header.writeUInt32LE(0, 4); // placeholder – patched in finalize()
        header.write('WAVE', 8);

        // fmt sub-chunk
        header.write('fmt ', 12);
        header.writeUInt32LE(16, 16); // sub-chunk size (PCM)
        header.writeUInt16LE(1, 20); // audio format: PCM
        header.writeUInt16LE(WavWriter.CHANNELS, 22);
        header.writeUInt32LE(WavWriter.SAMPLE_RATE, 24);
        header.writeUInt32LE(byteRate, 28);
        header.writeUInt16LE(blockAlign, 32);
        header.writeUInt16LE(WavWriter.BIT_DEPTH, 34);

        // data sub-chunk
        header.write('data', 36);
        header.writeUInt32LE(0, 40); // placeholder – patched in finalize()

        fs.writeSync(this.fd, header);
    }

    /** Appends raw PCM audio data. */
    write(data: Buffer) {
        fs.writeSync(this.fd, data);
        this.dataBytes += data.length;
    }

    /** Patches the WAV header with final sizes and closes the file. */
    finalize() {
        const fileSizeMinus8 = 36 + this.dataBytes;
        const buf = Buffer.alloc(4);

        // Patch RIFF chunk size at offset 4
        buf.writeUInt32LE(fileSizeMinus8, 0);
        fs.writeSync(this.fd, buf, 0, 4, 4);

        // Patch data sub-chunk size at offset 40
        buf.writeUInt32LE(this.dataBytes, 0);
        fs.writeSync(this.fd, buf, 0, 4, 40);

        fs.closeSync(this.fd);
    }
}

/**
 * Native TypeScript audio recorder. Creates one WAV file per peer, writing
 * raw PCM data as it arrives and finalizing the file when the peer leaves.
 *
 * Unlike other services, AudioRecorder does not use a provider or child
 * process — all recording logic runs in-process.
 */
class AudioRecorder extends ServiceController {
    private writers = new Map<string, WavWriter>();
    private filePathPrefix: string;

    constructor(scene: NetworkScene, filePathPrefix: string = './recordings/recorded_audio_') {
        // No provider — recording is handled natively in TypeScript
        super(scene, 'AudioRecorder');

        this.filePathPrefix = filePathPrefix;

        // Ensure the output directory exists
        const directory = path.dirname(filePathPrefix);
        fs.mkdirSync(directory, { recursive: true });

        // Clean up WAV files when peers leave
        if (this.roomClient) {
            this.roomClient.addListener('OnPeerRemoved', (peer: { uuid: string }) => {
                this.finalizeWriter(peer.uuid);
            });
        }
    }

    /**
     * Writes raw PCM audio data for a given peer. Creates a new WAV file
     * on the first call for each peer.
     */
    write(peerId: string, data: Buffer) {
        let writer = this.writers.get(peerId);
        if (!writer) {
            const timestamp = new Date().toISOString().replace(/:/g, '-');
            const filePath = `${this.filePathPrefix}${peerId}_${timestamp}.wav`;
            writer = new WavWriter(filePath);
            this.writers.set(peerId, writer);
            this.log(`Recording started for peer ${peerId}`);
        }
        writer.write(data);
    }

    /** Finalizes and closes the WAV file for a specific peer. */
    private finalizeWriter(peerId: string) {
        const writer = this.writers.get(peerId);
        if (writer) {
            writer.finalize();
            this.writers.delete(peerId);
            this.log(`Recording finalized for peer ${peerId}`);
        }
    }

    /** Finalizes all open WAV files (called on process exit). */
    finalizeAll() {
        for (const [peerId] of this.writers) {
            this.finalizeWriter(peerId);
        }
    }
}

export { AudioRecorder };
