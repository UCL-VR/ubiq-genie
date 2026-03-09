import type { ServiceProvider, ServiceConfig } from '../../../../components/service';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Creates a HuggingFace Transformers text generation provider (Python).
 *
 * The `model` option accepts:
 *   - A HuggingFace model ID: "Qwen/Qwen3-4B-Instruct-2507" (auto-downloaded)
 *   - An absolute path to a local model directory: "/home/user/models/qwen3-4b"
 *
 * NOTE: Running large models via HuggingFace Transformers requires significant RAM.
 * For example, Qwen3-4B needs ~12-14 GB in float16. For constrained hardware,
 * prefer the GGUF-quantised variant via the llama-cpp or ollama providers.
 */
export function createHuggingFaceProvider(options?: {
    model?: string;
    preprompt?: string;
}): ServiceProvider;
export function createHuggingFaceProvider(config?: ServiceConfig): ServiceProvider;
export function createHuggingFaceProvider(optionsOrConfig?: { model?: string; preprompt?: string } | ServiceConfig): ServiceProvider {
    const opts = optionsOrConfig ?? {};
    const model = ('model' in opts ? opts.model : undefined) ?? 'Qwen/Qwen3-4B-Instruct-2507';
    const preprompt = ('preprompt' in opts ? opts.preprompt : undefined)
        ?? ('options' in opts ? (opts.options as Record<string, unknown>)?.preprompt as string : undefined);

    const args = ['-u', path.join(__dirname, 'generate.py'), '--model', model];
    if (preprompt) {
        args.push('--preprompt', preprompt);
    }
    return {
        name: 'huggingface',
        command: 'python',
        args,
        processMode: 'singleton',
        requirements: path.join(__dirname, 'requirements.txt'),
    };
}
