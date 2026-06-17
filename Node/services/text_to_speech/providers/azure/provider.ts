import type { ServiceProvider } from '../../../../components/service';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Azure Cognitive Services Text-to-Speech provider.
 * Requires SPEECH_KEY and SPEECH_REGION environment variables.
 * Runs a single shared Python process (singleton mode).
 */
export const AzureTTSProvider: ServiceProvider = {
    name: 'azure',
    command: 'python',
    args: ['-u', path.join(__dirname, 'text_to_speech_azure.py')],
    processMode: 'singleton',
    requirements: path.join(__dirname, 'requirements.txt'),
};
