import { VertesiaClient } from "@vertesia/client";
import { ConfigModes, ExecutionRun, RunDataStorageLevel } from "@vertesia/common";
import { TextFallbackOptions } from "@llumiverse/common";

export class ExecutionQueue {
    requests: ExecutionRequest[] = [];
    private abortController: AbortController;

    constructor(public size = 4) {
        this.abortController = new AbortController();
    }

    add(request: ExecutionRequest) {
        this.requests.push(request);
    }

    abort() {
        this.abortController.abort();
    }

    async run(onBatch: (completed: ExecutionRun[]) => void, onChunk?: ((chunk: any) => void), signal?: AbortSignal) {
        // If an external signal is provided, link it to our local abort controller
        if (signal) {
            if (signal.aborted) {
                // If already aborted, abort our controller too and return early
                this.abortController.abort();
                return [];
            }

            // Forward external abort signals to our controller
            const forwardAbort = () => this.abortController.abort();
            signal.addEventListener('abort', forwardAbort, { once: true });

            // Clean up listener when done
            const cleanup = () => signal.removeEventListener('abort', forwardAbort);
            this.abortController.signal.addEventListener('abort', cleanup, { once: true });
        }

        const chunkSize = this.size;
        const out: ExecutionRun[] = [];
        const requests = this.requests;

        try {
            for (let i = 0; i < requests.length; i += chunkSize) {
                // Check if aborted before processing chunk
                if (this.abortController.signal.aborted) {
                    break;
                }

                const chunk = requests.slice(i, i + chunkSize);

                // Pass our abort signal to each request
                const res = await Promise.all(
                    chunk.map(request => request.run(onChunk, this.abortController.signal))
                );

                out.push(...res);

                // Only notify if not aborted
                if (!this.abortController.signal.aborted) {
                    onBatch(out);
                }
            }

            return out;
        } catch (error) {
            // If this is an abort error, just return what we have so far
            if (this.abortController.signal.aborted) {
                return out;
            }
            throw error;
        }
    }
}

function convertRunData(raw_run_data: any): RunDataStorageLevel | undefined {
    const levelStr: string = typeof raw_run_data === 'string' ? raw_run_data.toUpperCase() : "";
    return Object.values(RunDataStorageLevel).includes(levelStr as RunDataStorageLevel) ? levelStr as RunDataStorageLevel : undefined;
}

function convertConfigMode(raw_config_mode: any): ConfigModes | undefined {
    const configStr: string = typeof raw_config_mode === 'string' ? raw_config_mode.toUpperCase() : "";
    return Object.values(ConfigModes).includes(configStr as ConfigModes) ? configStr as ConfigModes : undefined;
}

export class ExecutionRequest {

    runNumber?: number;

    constructor(
        public readonly client: VertesiaClient,
        public interactionSpec: string, // namespace:name@version
        public data: any,
        public options: Record<string, any>) {
    }

    async run(onChunk?: ((chunk: any) => void), signal?: AbortSignal): Promise<ExecutionRun> {
        // Check if already aborted
        if (signal?.aborted) {
            throw new Error("Operation aborted");
        }

        const options = this.options;

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

        const config = {
            environment: typeof options.env === 'string' ? options.env : undefined,
            model: typeof options.model === 'string' ? options.model : undefined,
            model_options: model_options,
            configMode: convertConfigMode(options.configMode),
            run_data: convertRunData(options.runData),
        };
        const tags = options.tags ? options.tags.trim().split(/\s,*\s*/) : undefined;

        // Create a wrapper for the onChunk callback that checks for abort
        const abortAwareChunkHandler = onChunk ? (chunk: any) => {
            if (signal?.aborted) return;
            onChunk(chunk);
        } : undefined;

        let run;
        try {
            if (this.options.byId) {
                run = await this.client.interactions.execute(this.interactionSpec, {
                    data: this.data,
                    config,
                    tags
                }, abortAwareChunkHandler);
            } else {
                run = await this.client.interactions.executeByName(this.interactionSpec, {
                    data: this.data,
                    config,
                    tags
                }, abortAwareChunkHandler);
            }

            // Check if aborted during execution
            if (signal?.aborted) {
                throw new Error("Operation aborted");
            }

            // add count number in the run
            if (this.runNumber != null) {
                (run as any).runNumber = this.runNumber;
            }
            return run;
        } catch (error) {
            // Check if aborted
            if (signal?.aborted) {
                throw new Error("Operation aborted");
            }
            throw error;
        }
    }
}
