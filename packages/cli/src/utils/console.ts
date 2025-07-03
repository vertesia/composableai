import ansiColors from "ansi-colors";
import ansiEscapes from "ansi-escapes";
import { WriteStream } from "node:tty";
import { onExit } from "signal-exit";
/**
 * See https://github.com/sindresorhus/cli-spinners/blob/HEAD/spinners.json for more spinners
 */

interface SpinnerData {
    interval: number;
    frames: string[];
}

const spinners: Record<string, SpinnerData> = {
    "dots": {
        "interval": 200,
        "frames": [
            ".  ",
            ".. ",
            "...",
            " ..",
            "  .",
            "   "
        ]
    },
    "bar": {
        "interval": 80,
        "frames": [
            "[    ]",
            "[=   ]",
            "[==  ]",
            "[=== ]",
            "[====]",
            "[ ===]",
            "[  ==]",
            "[   =]",
        ]
    },
}

export class Spinner {

    data: SpinnerData;
    log: LogUpdate;
    timer?: NodeJS.Timeout;
    isRunning = false;

    style?: (spinner: string) => string;
    _prefix = '';
    _suffix = '';
    _restoreCursor = false;

    // Signal handlers for proper cleanup
    private signalHandlers: { [key: string]: () => void } = {};

    constructor(name: 'dots' | 'bar' = 'dots', stream?: WriteStream) {
        this.data = spinners[name];
        this.log = new LogUpdate(stream);

        // Set up interrupt handlers to ensure cleanup
        this.setupSignalHandlers();
    }

    private setupSignalHandlers() {
        // Create signal handlers for proper cleanup
        const handleSignal = () => {
            this.done(false);
            // Avoid adding a newline since that's handled by the system usually
        };

        // Store handlers so we can remove them later
        this.signalHandlers['SIGINT'] = handleSignal;
        this.signalHandlers['SIGTERM'] = handleSignal;

        // Register handlers
        process.on('SIGINT', handleSignal);
        process.on('SIGTERM', handleSignal);
    }

    private removeSignalHandlers() {
        // Remove all signal handlers
        Object.entries(this.signalHandlers).forEach(([signal, handler]) => {
            process.off(signal as NodeJS.Signals, handler);
        });

        // Clear handlers
        this.signalHandlers = {};
    }

    withStyle(style: (spinner: string) => string) {
        this.style = style;
        return this;
    }

    set prefix(value: string) {
        this._prefix = value;
    }
    get prefix() {
        return this._prefix;
    }
    set suffix(value: string) {
        this._suffix = value;
    }
    get suffix() {
        return this._suffix;
    }

    start(shodHideCursor = true) {
        // Don't start if already running
        if (this.isRunning) return this;

        this.isRunning = true;

        if (shodHideCursor) {
            hideCursor(this.log.stream);
            this._restoreCursor = true;
        }

        let i = 0;
        this.timer = setInterval(() => {
            if (!this.isRunning) return;

            try {
                const frames = this.data.frames;
                this.log.print(this.prefix + frames[++i % frames.length] + this.suffix);
            } catch (error) {
                // If we can't update, stop the spinner to prevent console issues
                this.done(false);
            }
        }, this.data.interval);

        return this;
    }

    done(replacement: boolean | string = '') {
        // Don't try to stop if already stopped
        if (!this.isRunning) return this;

        this.isRunning = false;

        if (this.timer) {
            clearInterval(this.timer);
            this.timer = undefined;
        }

        try {
            this.log.clear();

            if (this._prefix) {
                this.log.stream.write(this._prefix);
            }

            if (replacement === true) {
                this.log.stream.write(ansiColors.green(ansiColors.symbols.check));
            } else if (replacement === false) {
                this.log.stream.write(ansiColors.red(ansiColors.symbols.cross));
            } else {
                this.log.stream.write(replacement);
            }

            if (this._suffix) {
                this.log.stream.write(this._suffix);
            }

            console.log(); // print a new line

            if (this._restoreCursor) {
                showCursor(this.log.stream);
                this._restoreCursor = false;
            }
        } catch (error) {
            // If an error occurs during cleanup, make a best effort to restore the cursor
            try {
                showCursor(this.log.stream);
            } catch (_) {
                // Last resort - ignore errors in error handler
            }
        }

        // Remove signal handlers to avoid multiple handling
        this.removeSignalHandlers();

        return this;
    }
}

export class LogUpdate {

    stream: WriteStream;

    last?: string;

    constructor(stream?: WriteStream) {
        this.stream = stream || process.stdout;
    }

    clear() {
        if (this.last && this.stream.isTTY) {
            this.stream.clearLine(0);
            this.stream.cursorTo(0);
        }
        return this;
    }

    print(text: string) {
        this.clear();
        this.last = text;
        this.stream.write(text);
        return this;
    }

}

const streamsToRestore: WriteStream[] = [];
let restoreCursorIsRegistered = false;

export function toggleCursor(show: boolean, stream: WriteStream = process.stdout) {
    show ? showCursor(stream) : hideCursor(stream);
}

export function showCursor(stream: WriteStream = process.stdout) {
    const i = streamsToRestore.findIndex((s) => s === stream);
    if (i > -1) {
        streamsToRestore.splice(i, 1);
    }
    stream.write(ansiEscapes.cursorShow);
}

export function hideCursor(stream: WriteStream = process.stdout) {
    if (!streamsToRestore.includes(stream)) {
        restoreCursorOnExit();
        streamsToRestore.push(stream);
    }
    stream.write(ansiEscapes.cursorHide);
}

export function restoreCursorOnExit() {
    if (!restoreCursorIsRegistered) {
        restoreCursorIsRegistered = true;
        onExit(() => {
            streamsToRestore.forEach(stream => showCursor(stream));
        });
    }
}
