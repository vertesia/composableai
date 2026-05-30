import { TextDecoderStream } from './TextDecoderStream.js';
import { EventSourceParserStream, type ParsedEvent } from './EventSourceParserStream.js';

export type { ParsedEvent };

export interface ReconnectInterval {
    type: 'reconnect-interval';
    value: number;
}

export type ServerSentEvent = ParsedEvent | ReconnectInterval;
/**
 * A SSE response reader.
 * Usage client.get('/path', {reader: sse}) or client.post('/path', {reader: sse})
 * where sse is this function
 * @param response
 * @returns
 */
export async function sse(response: Response): Promise<ReadableStream<ServerSentEvent>> {
    if (!response.ok) {
        const text = await response.text();
        const error = new Error(`SSE error: ${response.status}. Content:\n${text}`) as Error & { status?: number };
        error.status = response.status;
        throw error;
    }
    if (!response.body) {
        throw new Error('No body in response');
    }
    return response.body.pipeThrough(new TextDecoderStream()).pipeThrough(new EventSourceParserStream());
}

// re-export TextDecoderStream (in case it was polyfilled)
export { TextDecoderStream };
