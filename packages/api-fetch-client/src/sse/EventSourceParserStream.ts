import { createParser, ReconnectInterval, type EventSourceParser, type ParsedEvent } from 'eventsource-parser'

/**
 * We copied this file from the eventsource-parser/stream package and made it a part of our project.
 * because importing the eventsource-parser/stream breaks tsc build when building the commonjs version
 * see for a similar error: 
 * https://stackoverflow.com/questions/77280140/why-typescript-dont-see-exports-of-package-with-module-commonjs-and-moduleres
 */

/**
 * A TransformStream that ingests a stream of strings and produces a stream of ParsedEvents.
 *
 * @example
 * ```
 * const eventStream =
 *   response.body
 *     .pipeThrough(new TextDecoderStream())
 *     .pipeThrough(new EventSourceParserStream())
 * ```
 * @public
 */
export class EventSourceParserStream extends TransformStream<string, ParsedEvent> {
    constructor() {
        let parser!: EventSourceParser

        super({
            start(controller) {
                parser = createParser((event: ParsedEvent | ReconnectInterval) => {
                    if (event.type === 'event') {
                        controller.enqueue(event)
                    }
                })
            },
            transform(chunk) {
                parser.feed(chunk)
            },
        })
    }
}
