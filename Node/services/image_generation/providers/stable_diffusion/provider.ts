import type { ServiceProvider } from '../../../../components/service';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Creates a Stable Diffusion image generation provider.
 * Uses the Hugging Face diffusers library locally.
 * Runs a single Python process, spawned lazily on first peer join (lazy-singleton mode).
 *
 * @param options - Optional output folder and prompt postfix.
 */
export function createStableDiffusionProvider(options?: {
    outputFolder?: string;
    promptPostfix?: string;
}): ServiceProvider {
    const args = ['-u', path.join(__dirname, 'text_2_image.py')];
    if (options?.outputFolder) {
        args.push('--output_folder', options.outputFolder);
    }
    if (options?.promptPostfix) {
        args.push('--prompt_postfix', options.promptPostfix);
    }
    return {
        name: 'stable-diffusion',
        command: 'python',
        args,
        processMode: 'lazy-singleton',
        requirements: path.join(__dirname, 'requirements.txt'),
    };
}
