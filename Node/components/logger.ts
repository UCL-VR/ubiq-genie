export class Logger {
    /**
     * Logs a message to the console with the base message and level.
     *
     * @param {string} baseMessage - The base message to prepend.
     * @param {string} message - The message to log.
     * @param {string} [level=info] - The level of the message (info, warning, error).
     * @param {string} [end='\n'] - The string to append to the message (default is newline).
     * @param {string} [baseNameColor='\x1b[35m'] - The color code for the base message.
     * @param {boolean} [boldBaseName=false] - Whether to bold the base message.
     */
    static log(
        baseMessage: string,
        message: string,
        level: 'info' | 'warning' | 'error' = 'info',
        end: string = '\n',
        baseNameColor: string = '\x1b[35m'
    ) {
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
}
