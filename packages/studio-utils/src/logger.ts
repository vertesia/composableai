export interface StudioUtilsLogger {
    warn(details: Record<string, unknown>, message: string): void;
}

// studio-utils deliberately excludes DOM/Node lib globals so browser and Node
// consumers stay symmetric. Declare the minimal console surface for the fallback logger.
declare const console: { warn(...args: unknown[]): void };

const consoleLogger: StudioUtilsLogger = {
    warn: (details, message) => {
        console.warn(message, details);
    },
};

let logger: StudioUtilsLogger = consoleLogger;

export function getStudioUtilsLogger(): StudioUtilsLogger {
    return logger;
}

export function installStudioUtilsLogger(customLogger: StudioUtilsLogger): StudioUtilsLogger {
    const previousLogger = logger;
    logger = customLogger;
    return previousLogger;
}
