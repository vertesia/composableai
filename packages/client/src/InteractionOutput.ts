import { CompletionResult } from '@llumiverse/common';
import { ExecutionRun, InteractionExecutionResult } from '@vertesia/common';

/**
 * Symbol used to mark InteractionOutputArray instances.
 * This allows us to detect if a CompletionResult[] has already been wrapped.
 */
export const IS_INTERACTION_OUTPUT = Symbol('InteractionOutput');

export function enhanceInteractionExecutionResult<ResultT = any, ParamsT = any>(r: InteractionExecutionResult<ParamsT>): EnhancedInteractionExecutionResult<ResultT, ParamsT> {
    (r as any).result = InteractionOutput.from<ResultT>(r.result);
    return r as EnhancedInteractionExecutionResult<ResultT, ParamsT>;
}

export function enhanceExecutionRun<ResultT = any, ParamsT = any>(r: ExecutionRun<ParamsT>): EnhancedExecutionRun<ResultT, ParamsT> {
    (r as any).result = InteractionOutput.from<ResultT>(r.result);
    return r as EnhancedExecutionRun<ResultT, ParamsT>;
}

/**
 * A convenient wrapper around CompletionResult[] that provides ergonomic accessors
 * for different result types (text, JSON/objects, images) from interaction executions.
 *
 * Use the static from() method to create a proxied array that acts as both
 * an array and has these convenience methods.
 *
 * @template T - The expected type of JSON/object results. Defaults to any.
 *
 * @example
 * ```typescript
 * // Recommended: Using the static from() method
 * const output = InteractionOutput.from<MyResponse>(run.result);
 * output[0];                        // CompletionResult (array access)
 * output.length;                    // number (array property)
 * const obj = output.object();      // MyResponse (custom method)
 * const text = output.text();         // string (custom getter)
 *
 * // Alternative: Using the class directly (less common)
 * const output = new InteractionOutput<MyResponse>(run.result);
 * const obj = output.object();      // Returns MyResponse
 * const objs = output.objects();    // Returns MyResponse[]
 *
 * // Override type for specific objects
 * interface OtherType { title: string; }
 * ```
 */
export class InteractionOutput<T = any> {
    /**
     * The raw completion results array.
     * Access this when you need to work with the underlying CompletionResult[] directly.
     */
    constructor(public readonly results: CompletionResult[]) { }

    /**
     * Create an interaction output that acts as both an array and has convenience methods.
     * This is the recommended way to work with interaction execution results.
     *
     * @template T - The expected type of JSON/object results. Defaults to any.
     * @param results - The raw CompletionResult array from an interaction execution
     * @returns A proxied array with convenience methods
     *
     * @example
     * ```typescript
     * interface MyResponse { name: string; age: number; }
     * const output = InteractionOutput.from<MyResponse>(run.result);
     *
     * // Array access
     * output[0];              // CompletionResult
     * output.length;          // number
     *
     * // Convenience methods
     * const obj = output.object();  // MyResponse
     * const text = output.text();     // string
     * ```
     */
    static from<T = any>(results: CompletionResult[] | InteractionOutputArray<T> | null | undefined): InteractionOutputArray<T> {
        if (!results) {
            return createInteractionOutput<T>([]);
        }
        // Check if already wrapped using the symbol marker        
        if ((results as any)[IS_INTERACTION_OUTPUT]) {
            return results as InteractionOutputArray<T>;
        }
        return createInteractionOutput<T>(results);
    }

    static isInteractionOutputArray(obj: any): boolean {
        return obj && obj[IS_INTERACTION_OUTPUT] === true;
    }

    get isEmpty() {
        return this.results.length === 0;
    }

    hasObject() {
        return this.results.some(r => r.type === 'json');
    }

    hasText() {
        return this.results.some(r => r.type === 'text');
    }

    hasImage() {
        return this.results.some(r => r.type === 'image');
    }

    /**
     * Get the concatenated text from all text results.
     * Returns an empty string if no text results exist.
     */
    text(delimiter = '\n'): string {
        return this.results
            .filter(r => r.type === 'text')
            .map(r => r.value)
            .join(delimiter);
    }

    /**
     * Get an array of all text values from text results.
     */
    texts(): string[] {
        return this.results
            .filter(r => r.type === 'text')
            .map(r => r.value);
    }

    /**
     * Get the first JSON result as a parsed object.
     * If no JSON result exists, attempts to parse the concatenated text as JSON.
     * @returns The first JSON result typed as T (the class generic type)
     * @throws Error if no JSON result found and text cannot be parsed as JSON
     */
    object(): T {
        const jsonResult = this.results.find(r => r.type === 'json');
        if (jsonResult) {
            return jsonResult.value as T;
        }

        // Fallback: try to parse the other text parts as JSON
        return parseCompletionResultAsJson(this.results);
    }

    /**
     * Get all JSON results as parsed objects.
     * @returns An array of all JSON results typed as T[] (the class generic type)
     */
    objects(): T[] {
        return this.results
            .filter(r => r.type === 'json')
            .map(r => r.value as T);
    }

    /**
     * Get a specific JSON result by index as a parsed object.
     * @template U - The type of the object at this index. Defaults to T (the class generic).
     * @param index - The zero-based index of the JSON result
     * @returns The JSON result at the specified index typed as U
     * @throws Error if the index is out of bounds
     */
    objectAt<U = T>(index: number): U {
        let i = 0;
        for (const result of this.results) {
            if (result.type === 'json') {
                if (i === index) {
                    return result.value as U;
                }
                i++;
            }
        }
        throw new Error(`Object at index ${index} not found`);
    }

    /**
     * Get the first image result (base64 data URL or URL).
     * @throws Error if no image result exists
     */
    image(): string {
        const imageResult = this.results.find(r => r.type === 'image');
        if (!imageResult) {
            throw new Error('No image result found');
        }
        return imageResult.value;
    }

    /**
     * Get an array of all image values (base64 data URLs or URLs).
     */
    images(): string[] {
        return this.results
            .filter(r => r.type === 'image')
            .map(r => r.value);
    }

    /**
     * Convert all results to a string representation.
     * Text and image results are used as-is, JSON results are stringified with the specified indent.
     * All parts are joined using the specified separator.
     *
     * @param separator - The separator to use between parts (default: '\n')
     * @param indent - The indentation to use for JSON.stringify (default: 0 = no formatting)
     * @returns A string representation of all results
     *
     * @example
     * ```typescript
     * const output = InteractionOutput.from(results);
     * output.stringify();           // Each part on a new line, compact JSON
     * output.stringify('\n\n', 2);  // Double newlines between parts, formatted JSON
     * output.stringify(' ');        // Space-separated, compact JSON
     * ```
     */
    stringify(separator = '\n', indent = 0): string {
        return this.results
            .map(r => {
                switch (r.type) {
                    case 'json':
                        return JSON.stringify(r.value, null, indent);
                    default:
                        return String(r.value);
                }
            })
            .join(separator);
    }

    /**
     * Convert to string representation (concatenated text).
     * Useful for template literals or string coercion.
     */
    toString(): string {
        return this.text();
    }

    /**
     * Convert to JSON representation.
     * Attempts to return the first JSON object, falls back to concatenated text.
     */
    toJSON(): CompletionResult[] {
        return this.results
    }
}

/**
 * Type representing a CompletionResult array enhanced with InteractionOutput methods.
 * This is the return type of InteractionOutput.from() - it acts as both an array and has convenience methods.
 */
export type InteractionOutputArray<T = any> = CompletionResult[] & InteractionOutput<T>;

export interface EnhancedInteractionExecutionResult<ResultT = any, ParamsT = any> extends InteractionExecutionResult<ParamsT> {
    result: InteractionOutputArray<ResultT>;
}

export interface EnhancedExecutionRun<ResultT = any, ParamsT = any> extends ExecutionRun<ParamsT> {
    result: InteractionOutputArray<ResultT>;
}

/**
 * Creates a proxied array that acts as both a CompletionResult[] and has InteractionOutput convenience methods.
 * Note: It's recommended to use InteractionOutput.from() instead of calling this function directly.
 *
 * @template T - The expected type of JSON/object results. Defaults to any.
 * @param results - The raw CompletionResult array from the interaction execution
 * @returns A proxy that behaves as both an array and has convenience methods
 *
 * @example
 * ```typescript
 * interface MyResponse { name: string; age: number; }
 * const output = createInteractionOutput<MyResponse>(run.result);
 *
 * // Array access
 * output[0];              // CompletionResult
 * output.length;          // number
 * output.map(r => r.type) // string[]
 *
 * // Convenience methods
 * const obj = output.object();  // MyResponse
 * const text = output.text();     // string
 * const img = output.image();     // string
 * ```
 */
export function createInteractionOutput<T = any>(results: CompletionResult[]): InteractionOutputArray<T> {
    const wrapper = new InteractionOutput<T>(results);

    return new Proxy(results, {
        get(target, prop, receiver) {
            // Return the marker symbol to identify wrapped arrays
            if (prop === IS_INTERACTION_OUTPUT) {
                return true;
            }

            // Check if the wrapper has this property/method
            if (prop in wrapper) {
                const value = (wrapper as any)[prop];
                // If it's a function, bind it to the wrapper so 'this' works correctly
                if (typeof value === 'function') {
                    return value.bind(wrapper);
                }
                // For getters and regular properties, just return the value
                return value;
            }
            // Otherwise delegate to the array
            return Reflect.get(target, prop, receiver);
        }
    }) as InteractionOutputArray<T>;
}


function parseCompletionResultAsJson(data: CompletionResult[]) {
    let lastError: Error | undefined;
    for (const part of data) {
        if (part.type === "text") {
            const text = part.value.trim();
            try {
                return JSON.parse(text);
            } catch (error: any) {
                lastError = error;
            }
        }
    }
    if (!lastError) {
        lastError = new Error("No JSON result found and no text available to parse");
    }
    throw lastError;
}
