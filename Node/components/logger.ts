export class Logger {
    /** Whether we are currently mid-way through a streaming log line. */
    private static _isStreaming: boolean = false;

    /**
     * Logs a message to the console with the base message and level.
     * If a streaming log line is active, it is terminated with a newline first.
     *
     * @param {string} baseMessage - The base message to prepend.
     * @param {string} message - The message to log.
     * @param {string} [level=info] - The level of the message (info, warning, error).
     * @param {string} [end='\n'] - The string to append to the message (default is newline).
     * @param {string} [baseNameColor='\x1b[35m'] - The color code for the base message.
     */
    static log(
        baseMessage: string,
        message: string,
        level: 'info' | 'warning' | 'error' = 'info',
        end: string = '\n',
        baseNameColor: string = '\x1b[35m'
    ) {
        // End any in-progress streaming line before writing a regular log
        this.flushStream();

        const formattedBaseMessage = `[${baseNameColor}${baseMessage}]\x1b[0m`;
        let colorCode = '';
        let output: NodeJS.WritableStream = process.stdout;

        switch (level) {
            case 'warning':
                colorCode = '\x1b[33m'; // orange
                output = process.stderr;
                break;
            case 'error':
                colorCode = '\x1b[31m'; // red
                output = process.stderr;
                break;
            default:
                colorCode = ''; // default color
        }

        output.write(`${formattedBaseMessage} ${colorCode}${message}\x1b[0m${end}`);
    }

    /**
     * Append streaming text to the current output line.
     *
     * On the first call (or after a flush / regular log), a new line is started
     * with the formatted prefix. Subsequent calls just append the text without
     * repeating the prefix.  No newline is emitted — call `flushStream()` to
     * terminate the line.
     *
     * @param {string} baseMessage - The prefix label (e.g. component name).
     * @param {string} text - The text fragment to append.
     * @param {string} [baseNameColor='\x1b[35m'] - The color code for the prefix.
     */
    static logStream(
        baseMessage: string,
        text: string,
        baseNameColor: string = '\x1b[35m'
    ): void {
        if (!this._isStreaming) {
            const formattedBaseMessage = `[${baseNameColor}${baseMessage}]\x1b[0m`;
            process.stdout.write(`${formattedBaseMessage} ${text}`);
            this._isStreaming = true;
        } else {
            process.stdout.write(text);
        }
    }

    /**
     * End the current streaming log line with a newline, if one is active.
     */
    static flushStream(): void {
        if (this._isStreaming) {
            process.stdout.write('\n');
            this._isStreaming = false;
        }
    }
}
