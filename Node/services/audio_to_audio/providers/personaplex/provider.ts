import type { ServiceProvider } from '../../../../components/service';
import path from 'path';
import { existsSync } from 'fs';
import nconf from 'nconf';

/**
 * Resolve the PersonaPlex installation directory from config.
 *
 * Reads from `services.audioToAudio.externalRepo.path` in config.json.
 */
function resolvePersonaPlexPath(): string {
    const configured: unknown = nconf.get('services:audioToAudio:externalRepo:path');

    if (typeof configured !== 'string' || configured.trim().length === 0) {
        throw new Error(
            'PersonaPlex repo path must be set in config.json under ' +
            'services.audioToAudio.externalRepo.path. ' +
            'Provide the absolute path to the PersonaPlex repository, e.g. "/home/user/personaplex".'
        );
    }

    const trimmed = configured.trim();
    if (!path.isAbsolute(trimmed)) {
        throw new Error(
            `externalRepo.path must be an absolute path, got: "${trimmed}". ` +
            `Example: "/home/user/personaplex"`
        );
    }

    return trimmed;
}

export interface PersonaPlexProviderOptions {
    /** Voice prompt filename inside --voice-prompt-dir (e.g. "NATM1.pt"). */
    voicePrompt?: string;
    /** Text system prompt for the model. */
    textPrompt?: string;
    /** Torch device (default: "cuda"). */
    device?: string;
    /** Enable CPU offloading for large models on limited GPU memory. */
    cpuOffload?: boolean;
    /** Audio sampling temperature (default: 0.8). */
    tempAudio?: number;
    /** Text sampling temperature (default: 0.7). */
    tempText?: number;
    /** Audio top-k sampling (default: 250). */
    topkAudio?: number;
    /** Text top-k sampling (default: 25). */
    topkText?: number;
}

/**
 * Creates a PersonaPlex audio-to-audio provider.
 *
 * PersonaPlex is a real-time, full-duplex speech-to-speech conversational
 * model. It replaces the entire STT → text generation → TTS pipeline with a
 * single process that ingests PCM16 audio and produces PCM16 audio + text.
 *
 * The child process runs `python -m moshi.stdio` with PYTHONPATH
 * pointed at the PersonaPlex installation's `moshi/` package directory.
 *
 * Prerequisites:
 *   - Clone PersonaPlex: `git clone https://github.com/NVIDIA/personaplex ../personaplex`
 *   - Install it: `pip install ../personaplex/moshi/.`
 *   - Accept the HF model license and set HF_TOKEN
 *   - CUDA GPU required (or use --cpu-offload)
 *
 * @param options - Model configuration overrides.
 */
export function createPersonaPlexProvider(options?: PersonaPlexProviderOptions): ServiceProvider {
    const personaplexPath = resolvePersonaPlexPath();
    const moshiPackageDir = path.join(personaplexPath, 'moshi');

    if (!existsSync(moshiPackageDir)) {
        throw new Error(
            `PersonaPlex not found at '${personaplexPath}'. ` +
                `Expected '${moshiPackageDir}' to exist.\n` +
                `Clone the repo:  git clone https://github.com/NVIDIA/personaplex "${personaplexPath}"\n` +
                `Install it:      pip install "${moshiPackageDir}/."\n` +
                `Or set "services.audioToAudio.externalRepo.path" in your app's config.json.`
        );
    }

    const voicePrompt = options?.voicePrompt ?? 'NATM1.pt';
    const textPrompt =
        options?.textPrompt ??
        'You are a wise and friendly teacher. Answer questions or provide advice in a clear and engaging way.';
    const device = options?.device ?? 'cuda';

    const args = [
        '-u',
        '-m',
        'moshi.stdio',
        '--voice-prompt',
        voicePrompt,
        '--text-prompt',
        textPrompt,
        '--device',
        device,
    ];

    if (options?.cpuOffload) {
        args.push('--cpu-offload');
    }
    if (options?.tempAudio !== undefined) {
        args.push('--temp-audio', String(options.tempAudio));
    }
    if (options?.tempText !== undefined) {
        args.push('--temp-text', String(options.tempText));
    }
    if (options?.topkAudio !== undefined) {
        args.push('--topk-audio', String(options.topkAudio));
    }
    if (options?.topkText !== undefined) {
        args.push('--topk-text', String(options.topkText));
    }

    // Set PYTHONPATH so `python -m moshi.stdio` resolves correctly
    const existingPythonPath = process.env['PYTHONPATH'] ?? '';
    const envPythonPath = existingPythonPath
        ? `${moshiPackageDir}:${existingPythonPath}`
        : moshiPackageDir;

    return {
        name: 'personaplex',
        command: 'python',
        args,
        processMode: 'singleton',
        env: { PYTHONPATH: envPythonPath },
    };
}
