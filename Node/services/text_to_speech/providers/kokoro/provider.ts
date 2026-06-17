import type { ServiceProvider } from '../../../../components/service';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Kokoro-82M Text-to-Speech provider using the local Kokoro model.
 * No API keys required — runs entirely locally.
 * Outputs 48kHz 16-bit mono PCM (upsampled from Kokoro's native 24kHz).
 * Runs a single shared Python process (singleton mode).
 */
export const KokoroTTSProvider: ServiceProvider = {
    name: 'kokoro',
    command: 'python',
    args: ['-u', path.join(__dirname, 'text_to_speech_kokoro.py')],
    processMode: 'singleton',
    requirements: path.join(__dirname, 'requirements.txt'),
};
