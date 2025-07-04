import { Command } from "commander";
import { resolve } from "path";
import { getClient } from "../client.js";
import { Spinner, restoreCursorOnExit } from "../utils/console.js";
import { writeJsonFile } from "../utils/stdio.js";
import { ConfigModes } from "@vertesia/common";
import { TextFallbackOptions } from "@llumiverse/common";

function convertConfigMode(raw_config_mode: any): ConfigModes | undefined {
    const configStr: string = typeof raw_config_mode === 'string' ? raw_config_mode.toUpperCase() : "";
    return Object.values(ConfigModes).includes(configStr as ConfigModes) ? configStr as ConfigModes : undefined;
}

export function genTestData(program: Command, interactionId: string, options: Record<string, any>) {
    const count = options.count ? parseInt(options.count) : 1;
    const message = options.message || undefined;
    const output = options.output || undefined;
    const spinner = new Spinner('dots');
    spinner.prefix = "Generating data. Please be patient ";

    // Create abort controller for handling interruption
    const abortController = new AbortController();
    const { signal } = abortController;

    // Set up cleanup function
    const cleanup = () => {
        spinner.done(false);
        console.log("\nData generation interrupted");
        process.exit(0);
    };

    // Set up signal handlers
    const handleSignal = () => {
        abortController.abort();
        cleanup();
    };

    process.on('SIGINT', handleSignal);
    process.on('SIGTERM', handleSignal);

    spinner.start();

    //TODO: Support for other modalities, like images
    const model_options: TextFallbackOptions = {
        _option_id: "text-fallback",
        temperature: typeof options.temperature === 'string' ? parseFloat(options.temperature) : undefined,
        max_tokens: typeof options.maxTokens === 'string' ? parseInt(options.maxTokens) : undefined,
        top_p: typeof options.topP === 'string' ? parseFloat(options.topP) : undefined,
        top_k: typeof options.topK === 'string' ? parseInt(options.topK) : undefined,
        presence_penalty: typeof options.presencePenalty === 'string' ? parseFloat(options.presencePenalty) : undefined,
        frequency_penalty: typeof options.frequencyPenalty === 'string' ? parseFloat(options.frequencyPenalty) : undefined,
        stop_sequence: options.stopSequence ? options.stopSequence.trim().split(/\s*,\s*/) : undefined,
    };

    getClient(program).interactions.generateTestData(interactionId, {
        count,
        message,
        config: {
            environment: options.env,
            model: options.model || undefined,
            model_options: model_options,
            configMode: convertConfigMode(options.configMode),
        }
        // Pass abort signal if the API supports it
        // signal
    }).then((result) => {
        // Remove signal handlers
        process.off('SIGINT', handleSignal);
        process.off('SIGTERM', handleSignal);

        spinner.done();
        if (output) {
            const file = resolve(output);
            writeJsonFile(file, result);
            console.log('Data saved in: ', output);
        }
        console.log();
        console.log(result);
    }).catch(err => {
        // Remove signal handlers
        process.off('SIGINT', handleSignal);
        process.off('SIGTERM', handleSignal);

        // Don't show error if aborted
        if (signal.aborted) {
            return;
        }

        spinner.done(false);
        console.log('Failed to generate data:', err.message);
    });
}

restoreCursorOnExit();
