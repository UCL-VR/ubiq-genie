import type { ServiceProvider, ServiceConfig } from '../../../../components/service';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const generateScript = path.join(__dirname, 'generate.mjs');

/**
 * Creates a llama.cpp text generation provider using node-llama-cpp (GGUF models).
 *
 * The `model` option accepts:
 *   - A HuggingFace GGUF reference: "hf:Qwen/Qwen3-4B-GGUF/Qwen3-4B-Q8_0.gguf" (auto-downloaded)
 *   - An absolute path to a local .gguf file: "/home/user/models/model.gguf"
 *
 * Set `thinking: true` to enable Qwen3's internal reasoning mode.
 * Default is off (appends /no_think) for low-latency voice use.
 */
export function createLlamaCppProvider(options?: {
    model?: string;
    preprompt?: string;
    thinking?: boolean;
}): ServiceProvider;
export function createLlamaCppProvider(config?: ServiceConfig): ServiceProvider;
export function createLlamaCppProvider(optionsOrConfig?: { model?: string; preprompt?: string; thinking?: boolean } | ServiceConfig): ServiceProvider {
    const opts = optionsOrConfig ?? {};
    const model = ('model' in opts ? opts.model : undefined) ?? 'hf:Qwen/Qwen3-4B-GGUF/Qwen3-4B-Q8_0.gguf';
    const preprompt = ('preprompt' in opts ? opts.preprompt : undefined)
        ?? ('options' in opts ? (opts.options as Record<string, unknown>)?.preprompt as string : undefined);
    const thinking = ('thinking' in opts ? opts.thinking : undefined)
        ?? ('options' in opts ? (opts.options as Record<string, unknown>)?.thinking as boolean : undefined);

    const args = [generateScript, '--model', model];
    if (preprompt) {
        args.push('--preprompt', preprompt);
    }
    if (thinking) {
        args.push('--thinking');
    }
    return {
        name: 'llama-cpp',
        command: 'node',
        args,
        processMode: 'singleton',
    };
}
