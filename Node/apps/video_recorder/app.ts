import { ApplicationController } from '../../components/application';
import { MediaReceiver } from '../../components/media_receiver';
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// The actual runtime shape of a video frame from RTCVideoSink.
// The @roamhq/wrtc type definitions are inaccurate for video —
// the real object has { width, height, data } in I420 format.
interface VideoFrame {
    width: number;
    height: number;
    data: Uint8Array;
    // RTCVideoSink may wrap the frame in an event object
    frame?: VideoFrame;
}

/**
 * Per-peer recording state. We spawn an ffmpeg process that accepts raw
 * I420 frames on stdin and writes an MP4 file.
 */
interface PeerRecording {
    ffmpeg: ChildProcess;
    filePath: string;
    width: number;
    height: number;
    frameCount: number;
}

/** Key for the recordings map: combines peer UUID with track ID. */
function recordingKey(uuid: string, trackId: string): string {
    return `${uuid}::${trackId}`;
}

class VideoRecorder extends ApplicationController {
    components: {
        mediaReceiver?: MediaReceiver;
    } = {};

    private recordings = new Map<string, PeerRecording>();
    private recordingsDir: string;
    private shuttingDown = false;

    constructor(configFile: string = 'config.json') {
        super(configFile);
        this.recordingsDir = path.resolve(
            path.dirname(fileURLToPath(import.meta.url)),
            'recordings',
        );
    }

    start(): void {
        this.registerComponents();
        this.log(`Components registered: ${Object.keys(this.components).join(', ')}`);

        this.definePipeline();
        this.log('Pipeline defined');

        this.joinRoom();
    }

    registerComponents(): void {
        // A MediaReceiver to receive video tracks sent by MediaTrackManager
        this.components.mediaReceiver = new MediaReceiver(this.scene);
    }

    definePipeline(): void {
        // Ensure the recordings directory exists
        if (!fs.existsSync(this.recordingsDir)) {
            fs.mkdirSync(this.recordingsDir, { recursive: true });
        }

        // Handle incoming video frames
        this.components.mediaReceiver?.on('video', (trackId: string, uuid: string, rawFrame: any) => {
            // MediaReceiver already unwraps event.frame, but guard in case
            const frame: VideoFrame = rawFrame?.frame ?? rawFrame;
            if (!frame || !frame.width || !frame.height || !frame.data) {
                return;
            }

            const key = recordingKey(uuid, trackId);
            let rec = this.recordings.get(key);

            // If resolution changed, finalize the old recording and start a new one
            if (rec && (rec.width !== frame.width || rec.height !== frame.height)) {
                this.log(`Resolution changed for ${trackId}@${uuid} (${rec.width}x${rec.height} -> ${frame.width}x${frame.height}), starting new file`);
                this.finalizeRecording(key);
                rec = undefined;
            }

            // Start a new recording for this peer if needed
            if (!rec) {
                rec = this.startRecording(trackId, uuid, frame.width, frame.height);
                this.recordings.set(key, rec);
            }

            // Write the raw I420 frame to ffmpeg's stdin
            try {
                rec.ffmpeg.stdin?.write(
                    Buffer.from(frame.data.buffer, frame.data.byteOffset, frame.data.byteLength),
                );
                rec.frameCount++;
            } catch (err) {
                this.log(`Error writing frame for ${trackId}@${uuid}: ${err}`, 'error');
            }
        });

        // Clean up when a peer disconnects
        this.components.mediaReceiver?.peerConnectionManager.addListener(
            'OnPeerConnectionRemoved',
            (component: any) => {
                if (component?.uuid) {
                    // Finalize all recordings for this peer (any track)
                    for (const key of this.recordings.keys()) {
                        if (key.startsWith(component.uuid + '::')) {
                            this.finalizeRecording(key);
                        }
                    }
                }
            },
        );

        // Graceful shutdown
        const shutdown = async () => {
            if (this.shuttingDown) {
                return;
            }
            this.shuttingDown = true;
            this.log('Shutting down, finalizing all recordings...');
            const waits: Promise<void>[] = [];
            for (const key of this.recordings.keys()) {
                waits.push(this.finalizeRecordingAndWait(key));
            }
            await Promise.allSettled(waits);
            process.exit(0);
        };
        process.on('SIGINT', () => {
            void shutdown();
        });
        process.on('SIGTERM', () => {
            void shutdown();
        });
    }

    /**
     * Spawn an ffmpeg process that reads raw I420 video on stdin and writes
     * an MP4 file. We use 30 fps as a default — WebRTC typically sends
     * frames at the capture rate, which for a Unity camera is usually the
     * application frame rate.
     */
    private startRecording(trackId: string, uuid: string, width: number, height: number): PeerRecording {
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const safeTrackId = trackId.replace(/[^a-zA-Z0-9_-]/g, '_') || 'default';
        const filename = `video_${safeTrackId}_${uuid}_${timestamp}.mp4`;
        const filePath = path.join(this.recordingsDir, filename);

        this.log(`Starting recording for track '${trackId}' from ${uuid}: ${filename} (${width}x${height})`);

        const ffmpeg = spawn('ffmpeg', [
            '-y',                          // overwrite output
            '-f', 'rawvideo',              // input format: raw video
            '-pixel_format', 'yuv420p',    // I420 = YUV 4:2:0 planar
            '-video_size', `${width}x${height}`,
            '-framerate', '30',            // assumed input framerate
            '-i', 'pipe:0',               // read from stdin
            '-c:v', 'libx264',            // encode with H.264
            '-preset', 'fast',            // balance speed / quality
            '-crf', '23',                 // constant rate factor
            '-pix_fmt', 'yuv420p',        // ensure output compatibility
            '-movflags', '+faststart',    // enable progressive playback
            filePath,
        ], {
            stdio: ['pipe', 'ignore', 'pipe'],
        });

        ffmpeg.stderr?.on('data', (data: Buffer) => {
            // Only log ffmpeg errors, not the verbose progress output
            const msg = data.toString();
            if (msg.toLowerCase().includes('error')) {
                this.log(`ffmpeg error for ${trackId}@${uuid}: ${msg}`, 'error');
            }
        });

        ffmpeg.on('close', (code) => {
            if (code !== 0 && code !== null) {
                this.log(`ffmpeg exited with code ${code} for ${trackId}@${uuid}`, 'warning');
            }
        });

        return { ffmpeg, filePath, width, height, frameCount: 0 };
    }

    /**
     * Close the ffmpeg stdin to signal end-of-stream and finalize the file.
     */
    private finalizeRecording(key: string): void {
        const rec = this.recordings.get(key);
        if (!rec) return;

        this.log(`Finalizing recording for ${key}: ${path.basename(rec.filePath)} (${rec.frameCount} frames)`);

        try {
            rec.ffmpeg.stdin?.end();
        } catch {
            // stdin may already be closed
        }
        this.recordings.delete(key);
    }

    private finalizeRecordingAndWait(key: string): Promise<void> {
        const rec = this.recordings.get(key);
        if (!rec) {
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            rec.ffmpeg.once('close', () => resolve());
            this.finalizeRecording(key);
        });
    }
}

export { VideoRecorder };

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    const configPath = './config.json';
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const absConfigPath = path.resolve(__dirname, configPath);
    const app = new VideoRecorder(absConfigPath);
    app.start();
}
