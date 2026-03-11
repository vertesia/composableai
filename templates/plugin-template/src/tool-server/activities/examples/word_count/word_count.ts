import { RemoteActivityExecutionPayload } from "@vertesia/common";
import { ActivityExecutionContext } from "@vertesia/tools-sdk";

export interface WordCountParams {
    text: string;
}

export interface WordCountResult {
    word_count: number;
    character_count: number;
}

/**
 * Counts words and characters in a text string.
 * This is a simple example of a remote activity that can be invoked from DSL workflows.
 */
export async function wordCount(
    payload: RemoteActivityExecutionPayload<WordCountParams>,
    _context: ActivityExecutionContext
): Promise<WordCountResult> {
    const { text } = payload.params;
    if (!text || typeof text !== 'string') {
        throw new Error('Missing or invalid "text" parameter');
    }
    const words = text.trim().split(/\s+/).filter(Boolean);
    return {
        word_count: words.length,
        character_count: text.length,
    };
}
