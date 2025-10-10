import { CompletionResult } from '@llumiverse/common';
import { ExecutionRun, InteractionExecutionResult } from '@vertesia/common';


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
 * const text = output.text;         // string (custom getter)
 *
 * // Alternative: Using the class directly (less common)
 * const output = new InteractionOutput<MyResponse>(run.result);
 * const obj = output.object();      // Returns MyResponse
 * const objs = output.objects();    // Returns MyResponse[]
 *
 * // Override type for specific objects
 * interface OtherType { title: string; }
 * const other = output.objectAt<OtherType>(1);  // Returns OtherType
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
     * const text = output.text;     // string
     * ```
     */
    static from<T = any>(results: CompletionResult[]): InteractionOutputArray<T> {
        return createInteractionOutput<T>(results || []);
    }

    /**
     * Get the concatenated text from all text results.
     * Returns an empty string if no text results exist.
     */
    get text(): string {
        return this.results
            .filter(r => r.type === 'text')
            .map(r => r.value)
            .join('');
    }

    /**
     * Get an array of all text values from text results.
     */
    get texts(): string[] {
        return this.results
            .filter(r => r.type === 'text')
            .map(r => r.value);
    }

    /**
     * Get a specific text result by index.
     * @param index - The zero-based index of the text result
     * @throws Error if the index is out of bounds
     */
    textAt(index: number): string {
        const texts = this.texts;
        if (index < 0 || index >= texts.length) {
            throw new Error(`Text index ${index} out of bounds (available: ${texts.length})`);
        }
        return texts[index];
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

        // Fallback: try to parse text as JSON for backward compatibility
        const text = this.text;
        if (text.length === 0) {
            throw new Error('No JSON result found and no text available to parse');
        }

        try {
            return JSON.parse(text) as T;
        } catch (err) {
            throw new Error(`No JSON result found and failed to parse text as JSON: ${err instanceof Error ? err.message : String(err)}`);
        }
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
        const jsonObjects = this.results.filter(r => r.type === 'json');
        if (index < 0 || index >= jsonObjects.length) {
            throw new Error(`Object index ${index} out of bounds (available: ${jsonObjects.length})`);
        }
        return jsonObjects[index].value as U;
    }

    /**
     * Get the first image result (base64 data URL or URL).
     * @throws Error if no image result exists
     */
    get image(): string {
        const imageResult = this.results.find(r => r.type === 'image');
        if (!imageResult) {
            throw new Error('No image result found');
        }
        return imageResult.value;
    }

    /**
     * Get an array of all image values (base64 data URLs or URLs).
     */
    get images(): string[] {
        return this.results
            .filter(r => r.type === 'image')
            .map(r => r.value);
    }

    /**
     * Get a specific image result by index.
     * @param index - The zero-based index of the image result
     * @throws Error if the index is out of bounds
     */
    imageAt(index: number): string {
        const images = this.images;
        if (index < 0 || index >= images.length) {
            throw new Error(`Image index ${index} out of bounds (available: ${images.length})`);
        }
        return images[index];
    }

    /**
     * Convert to string representation (concatenated text).
     * Useful for template literals or string coercion.
     */
    toString(): string {
        return this.text;
    }

    /**
     * Convert to JSON representation.
     * Attempts to return the first JSON object, falls back to concatenated text.
     */
    toJSON(): any {
        try {
            return this.object();
        } catch {
            return this.text;
        }
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
 * const text = output.text;     // string
 * const img = output.image;     // string
 * ```
 */
export function createInteractionOutput<T = any>(results: CompletionResult[]): InteractionOutputArray<T> {
    const wrapper = new InteractionOutput<T>(results);

    return new Proxy(results, {
        get(target, prop, receiver) {
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
