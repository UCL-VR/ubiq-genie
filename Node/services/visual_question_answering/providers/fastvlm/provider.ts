import type { ServiceProvider } from '../../../../components/service';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import nconf from 'nconf';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Resolve the ml-fastvlm repository path from config.
 *
 * The `fastvlmRepoPath` key in config.json must be an absolute path pointing
 * to the cloned ml-fastvlm repository. The directory must contain `llava/`.
 */
function resolveRepoPath(): string {
    const configured: unknown = nconf.get('fastvlmRepoPath');
    if (typeof configured !== 'string' || configured.trim().length === 0) {
        throw new Error(
            'fastvlmRepoPath must be set in config.json. ' +
            'Provide the absolute path to the ml-fastvlm repository.\n' +
            'Clone: git clone https://github.com/apple/ml-fastvlm\n' +
            'Install: pip install -e /path/to/ml-fastvlm\n' +
            'Download models: cd /path/to/ml-fastvlm && bash get_models.sh'
        );
    }

    const trimmed = configured.trim();
    if (!path.isAbsolute(trimmed)) {
        throw new Error(
            `fastvlmRepoPath must be an absolute path, got: "${trimmed}". ` +
            `Example: "/home/user/ml-fastvlm"`
        );
    }

    if (!existsSync(path.join(trimmed, 'llava'))) {
        throw new Error(
            `ml-fastvlm not found at '${trimmed}'. ` +
            `Expected '${path.join(trimmed, 'llava')}' to exist.\n` +
            `Clone the repo:  git clone https://github.com/apple/ml-fastvlm "${trimmed}"\n` +
            `Install it:      pip install -e "${trimmed}"\n` +
            `Or set "fastvlmRepoPath" in your app's config.json.`
        );
    }

    return trimmed;
}

export interface FastVLMProviderOptions {
    /**
     * Path to the FastVLM checkpoint directory.
     * Can be an absolute path, or a name relative to {repoPath}/checkpoints/
     * (e.g. "llava-fastvithd_0.5b_stage3").
     */
    modelPath?: string;
    /** Conversation template mode (default: "qwen_2"). */
    convMode?: string;
    /** Sampling temperature; 0 = greedy (default: 0.2). */
    temperature?: number;
    /** Maximum tokens to generate (default: 100). */
    maxNewTokens?: number;
}

/**
 * Creates a FastVLM visual question answering provider using the official
 * Apple ml-fastvlm repository.
 *
 * Prerequisites:
 *   - Clone: git clone https://github.com/apple/ml-fastvlm
 *   - Install: pip install -e /path/to/ml-fastvlm
 *   - Download checkpoints: cd /path/to/ml-fastvlm && bash get_models.sh
 *   - Set "fastvlmRepoPath" in your app's config.json
 *
 * @param options - Model and generation overrides.
 */
export function createFastVLMProvider(options?: FastVLMProviderOptions): ServiceProvider {
    const repoPath = resolveRepoPath();

    // Resolve model path: absolute paths pass through; relative names are
    // resolved under {repoPath}/checkpoints/.
    const modelName = options?.modelPath ?? 'llava-fastvithd_0.5b_stage3';
    const modelPath = path.isAbsolute(modelName)
        ? modelName
        : path.join(repoPath, 'checkpoints', modelName);

    if (!existsSync(modelPath)) {
        throw new Error(
            `FastVLM checkpoint not found at '${modelPath}'.\n` +
            `Download checkpoints: cd "${repoPath}" && bash get_models.sh`
        );
    }

    const args = [
        '-u',
        path.join(__dirname, 'fastvlm_vqa.py'),
        '--model-path', modelPath,
    ];

    if (options?.convMode) {
        args.push('--conv-mode', options.convMode);
    }
    if (options?.temperature !== undefined) {
        args.push('--temperature', String(options.temperature));
    }
    if (options?.maxNewTokens !== undefined) {
        args.push('--max-new-tokens', String(options.maxNewTokens));
    }

    // Set PYTHONPATH so the llava package from the repo is importable
    const existingPythonPath = process.env['PYTHONPATH'] ?? '';
    const envPythonPath = existingPythonPath
        ? `${repoPath}:${existingPythonPath}`
        : repoPath;

    return {
        name: 'fastvlm',
        command: 'python',
        args,
        processMode: 'singleton',
        env: { PYTHONPATH: envPythonPath },
    };
}
