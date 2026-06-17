import type { ServiceProvider } from '../../../../components/service';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Creates an OpenAI ChatGPT text generation provider.
 * Requires OPENAI_API_KEY environment variable.
 * Runs a single shared Python process (singleton mode).
 *
 * @param options - Optional preprompt and prompt suffix to pass to the script.
 */
export function createOpenAIProvider(options?: {
    preprompt?: string;
    promptSuffix?: string;
}): ServiceProvider {
    const args = ['-u', path.join(__dirname, 'openai_chatgpt.py')];
    if (options?.preprompt !== undefined) {
        args.push('--preprompt', options.preprompt);
    }
    if (options?.promptSuffix !== undefined) {
        args.push('--prompt_suffix', options.promptSuffix);
    }
    return {
        name: 'openai',
        command: 'python',
        args,
        processMode: 'singleton',
        requirements: path.join(__dirname, 'requirements.txt'),
    };
}
