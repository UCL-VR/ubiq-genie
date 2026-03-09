import type { ServiceProvider, ServiceConfig } from '../../../../components/service';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const generateScript = path.join(__dirname, 'generate.mjs');

/**
 * Creates an Ollama text generation provider.
 *
 * The `model` option accepts any Ollama model tag, for example:
 *   - "hf.co/Qwen/Qwen3-4B-GGUF:Q8_0" (HuggingFace reference)
 *   - "llama3" (Ollama library model)
 *
 * Requires `ollama serve` to be running.
 * Set `thinking: true` to enable Qwen3's internal reasoning mode.
 * Default is off (appends /no_think) for low-latency voice use.
 */
export function createOllamaProvider(options?: {
    model?: string;
    preprompt?: string;
    thinking?: boolean;
    host?: string;
}): ServiceProvider;
export function createOllamaProvider(config?: ServiceConfig): ServiceProvider;
export function createOllamaProvider(optionsOrConfig?: { model?: string; preprompt?: string; thinking?: boolean; host?: string } | ServiceConfig): ServiceProvider {
    const opts = optionsOrConfig ?? {};
    const model = ('model' in opts ? opts.model : undefined) ?? 'hf.co/Qwen/Qwen3-4B-GGUF:Q8_0';
    const preprompt = ('preprompt' in opts ? opts.preprompt : undefined)
        ?? ('options' in opts ? (opts.options as Record<string, unknown>)?.preprompt as string : undefined);
    const thinking = ('thinking' in opts ? opts.thinking : undefined)
        ?? ('options' in opts ? (opts.options as Record<string, unknown>)?.thinking as boolean : undefined);
    const host = ('host' in opts ? opts.host : undefined)
        ?? ('options' in opts ? (opts.options as Record<string, unknown>)?.host as string : undefined);

    const args = [generateScript, '--model', model];
    if (preprompt) {
        args.push('--preprompt', preprompt);
    }
    if (thinking) {
        args.push('--thinking');
    }
    if (host) {
        args.push('--host', host);
    }
    return {
        name: 'ollama',
        command: 'node',
        args,
        processMode: 'singleton',
    };
}
