import type { ServiceProvider } from '../../../../components/service';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * NVIDIA Nemotron Speech Streaming 0.6B speech-to-text provider.
 *
 * Uses cache-aware streaming inference for low-latency, real-time
 * transcription. Unlike batch models (e.g. Parakeet), this model
 * processes audio in ~1.12s chunks while maintaining encoder cache
 * state across steps, so each chunk benefits from full prior context.
 *
 * Key features:
 * - Cache-aware FastConformer encoder with RNNT decoder
 * - Built-in punctuation and capitalization
 * - Configurable latency via att_context_size (80ms–1120ms chunks)
 * - No API keys required (runs locally via NeMo)
 *
 * Runs one Python process per peer (per-peer mode).
 */
export const NemotronStreamingSTTProvider: ServiceProvider = {
    name: 'nemotron-streaming',
    command: 'python',
    args: ['-u', path.join(__dirname, 'transcribe_nemotron_streaming.py')],
    processMode: 'per-peer',
    requirements: path.join(__dirname, 'requirements.txt'),
};
