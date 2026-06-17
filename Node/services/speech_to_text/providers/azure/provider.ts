import type { ServiceProvider } from '../../../../components/service';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Azure Cognitive Services Speech-to-Text provider.
 * Requires SPEECH_KEY and SPEECH_REGION environment variables.
 * Runs one Python process per peer (per-peer mode).
 */
export const AzureSTTProvider: ServiceProvider = {
    name: 'azure',
    command: 'python',
    args: ['-u', path.join(__dirname, 'transcribe_azure.py')],
    processMode: 'per-peer',
    requirements: path.join(__dirname, 'requirements.txt'),
};
