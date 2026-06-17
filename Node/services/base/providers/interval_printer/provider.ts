import type { ServiceProvider } from '../../../../components/service';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Sample provider that prints "Hello world!" every 5 seconds.
 * Runs a single Python process (singleton mode).
 */
export const IntervalPrinterProvider: ServiceProvider = {
    name: 'interval-printer',
    command: 'python',
    args: ['-u', path.join(__dirname, 'interval_text_printer.py')],
    processMode: 'singleton',
};
