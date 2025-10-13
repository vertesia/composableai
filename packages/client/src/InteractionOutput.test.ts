import { CompletionResult } from '@llumiverse/common';
import { describe, expect, it } from 'vitest';
import { InteractionOutput, IS_INTERACTION_OUTPUT } from './InteractionOutput.js';

describe('InteractionOutput', () => {
    const sampleResults: CompletionResult[] = [
        { type: 'text', value: 'Hello, ' },
        { type: 'text', value: 'World!' },
        { type: 'json', value: { name: 'Alice', age: 30 } },
        { type: 'json', value: { title: 'Engineer', level: 'Senior' } },
        { type: 'image', value: 'data:image/png;base64,iVBORw0K...' },
        { type: 'image', value: 'https://example.com/image.jpg' }
    ];

    describe('text accessors', () => {
        it('should concatenate all text results', () => {
            const output = InteractionOutput.from(sampleResults);
            expect(output.text('')).toBe('Hello, World!');
        });

        it('should return empty string when no text results exist', () => {
            const output = InteractionOutput.from([
                { type: 'json', value: { foo: 'bar' } }
            ]);
            expect(output.text()).toBe('');
        });

        it('should return all text values as array', () => {
            const output = InteractionOutput.from(sampleResults);
            expect(output.texts()).toEqual(['Hello, ', 'World!']);
        });

    });

    describe('object accessors', () => {
        it('should return first JSON object', () => {
            const output = InteractionOutput.from<{ name: string; age: number }>(sampleResults);
            const obj = output.object();
            expect(obj).toEqual({ name: 'Alice', age: 30 });
        });

        it('should return all JSON objects', () => {
            const output = InteractionOutput.from(sampleResults);
            const objects = output.objects();
            expect(objects).toEqual([
                { name: 'Alice', age: 30 },
                { title: 'Engineer', level: 'Senior' }
            ]);
        });

        it('should parse text as JSON when no JSON result exists', () => {
            const output = InteractionOutput.from([
                { type: 'text', value: '{"foo":"bar"}' }
            ]);
            expect(output.object()).toEqual({ foo: 'bar' });
        });

        it('should throw error when no JSON result and text is not valid JSON', () => {
            const output = InteractionOutput.from([
                { type: 'text', value: 'not json' }
            ]);
            expect(() => output.object()).toThrow();
        });

        it('should throw error when no JSON result and no text', () => {
            const output = InteractionOutput.from([
                { type: 'image', value: 'data:image/png;base64,abc' }
            ]);
            expect(() => output.object()).toThrow('No JSON result found and no text available to parse');
        });
    });

    describe('image accessors', () => {
        it('should return first image', () => {
            const output = InteractionOutput.from(sampleResults);
            expect(output.image()).toBe('data:image/png;base64,iVBORw0K...');
        });

        it('should return all images', () => {
            const output = InteractionOutput.from(sampleResults);
            expect(output.images()).toEqual([
                'data:image/png;base64,iVBORw0K...',
                'https://example.com/image.jpg'
            ]);
        });

        it('should throw error when no image result exists', () => {
            const output = InteractionOutput.from([
                { type: 'text', value: 'hello' }
            ]);
            expect(() => output.image()).toThrow('No image result found');
        });

    });

    describe('utility methods', () => {
        it('should convert to string (concatenated text)', () => {
            const output = InteractionOutput.from(sampleResults);
            expect(output.toString()).toBe('Hello, \nWorld!');
        });

        it('should convert to JSON the resuilts array', () => {
            const output = InteractionOutput.from(sampleResults);
            expect(output.toJSON()).toEqual(sampleResults);
        });

        it('should stringify all parts with default separator and compact JSON', () => {
            const output = InteractionOutput.from(sampleResults);
            const result = output.stringify();

            expect(result).toBe(
                'Hello, \n' +
                'World!\n' +
                '{"name":"Alice","age":30}\n' +
                '{"title":"Engineer","level":"Senior"}\n' +
                'data:image/png;base64,iVBORw0K...\n' +
                'https://example.com/image.jpg'
            );
        });

        it('should stringify all parts with formatted JSON', () => {
            const mixed: CompletionResult[] = [
                { type: 'text', value: 'Result:' },
                { type: 'json', value: { score: 95, status: 'pass' } }
            ];
            const output = InteractionOutput.from(mixed);
            const result = output.stringify('\n', 2);

            expect(result).toBe(
                'Result:\n' +
                '{\n' +
                '  "score": 95,\n' +
                '  "status": "pass"\n' +
                '}'
            );
        });

        it('should stringify with custom separator', () => {
            const mixed: CompletionResult[] = [
                { type: 'text', value: 'A' },
                { type: 'json', value: { x: 1 } },
                { type: 'text', value: 'B' }
            ];
            const output = InteractionOutput.from(mixed);
            const result = output.stringify(' | ');

            expect(result).toBe('A | {"x":1} | B');
        });

        it('should stringify with empty separator', () => {
            const mixed: CompletionResult[] = [
                { type: 'text', value: 'Hello' },
                { type: 'text', value: 'World' }
            ];
            const output = InteractionOutput.from(mixed);
            const result = output.stringify('');

            expect(result).toBe('HelloWorld');
        });

    });

    describe('Proxy functionality', () => {
        it('should work as an array', () => {
            const output = InteractionOutput.from(sampleResults);

            // Array access
            expect(output[0]).toEqual({ type: 'text', value: 'Hello, ' });
            expect(output[1]).toEqual({ type: 'text', value: 'World!' });

            // Array properties
            expect(output.length).toBe(6);

            // Array methods
            const types = output.map(r => r.type);
            expect(types).toEqual(['text', 'text', 'json', 'json', 'image', 'image']);

            const textResults = output.filter(r => r.type === 'text');
            expect(textResults).toHaveLength(2);
        });

        it('should have convenience methods on the array', () => {
            const output = InteractionOutput.from<{ name: string; age: number }>(sampleResults);

            // Should work as array AND have custom methods
            expect(output.length).toBe(6);
            expect(output.text('')).toBe('Hello, World!');
            expect(output.object()).toEqual({ name: 'Alice', age: 30 });
        });

        it('should be marked with IS_INTERACTION_OUTPUT symbol', () => {
            const output = InteractionOutput.from(sampleResults);

            // Check that the symbol marker is present
            expect((output as any)[IS_INTERACTION_OUTPUT]).toBe(true);
        });

        it('should return the same instance when calling from() on an already wrapped array', () => {
            const output1 = InteractionOutput.from(sampleResults);

            // Calling from() again should return the same instance
            const output2 = InteractionOutput.from(output1);

            // Should be the exact same reference
            expect(output2).toBe(output1);

            // Verify it still works correctly
            expect(output2.text()).toBe('Hello, \nWorld!');
            expect(output2.length).toBe(6);
        });

        it('should not double-wrap when passing an InteractionOutputArray', () => {
            const output1 = InteractionOutput.from<{ name: string; age: number }>(sampleResults);
            const output2 = InteractionOutput.from(output1);
            const output3 = InteractionOutput.from(output2);

            // All should be the same reference
            expect(output1).toBe(output2);
            expect(output2).toBe(output3);

            // Functionality should remain intact
            expect(output3.object()).toEqual({ name: 'Alice', age: 30 });
        });
    });

    describe('Direct class usage', () => {
        it('should work when using class directly', () => {
            const wrapper = new InteractionOutput<{ name: string; age: number }>(sampleResults);

            expect(wrapper.text('')).toBe('Hello, World!');
            expect(wrapper.object()).toEqual({ name: 'Alice', age: 30 });
            expect(wrapper.results).toBe(sampleResults);
        });
    });

    describe('Edge cases', () => {
        it('should handle empty results array', () => {
            const output = InteractionOutput.from([]);

            expect(output.text()).toBe('');
            expect(output.texts()).toEqual([]);
            expect(output.objects()).toEqual([]);
            expect(output.images()).toEqual([]);
            expect(() => output.object()).toThrow();
            expect(() => output.image()).toThrow();
        });

        it('should handle mixed content types', () => {
            const mixed: CompletionResult[] = [
                { type: 'text', value: 'Start' },
                { type: 'json', value: { count: 5 } },
                { type: 'text', value: 'End' }
            ];

            const output = InteractionOutput.from(mixed);
            expect(output.text()).toBe('Start\nEnd');
            expect(output.object()).toEqual({ count: 5 });
        });

        it('should handle results with only one type', () => {
            const textOnly: CompletionResult[] = [
                { type: 'text', value: 'Only text here' }
            ];

            const output = InteractionOutput.from(textOnly);
            expect(output.text()).toBe('Only text here');
            expect(output.objects()).toEqual([]);
            expect(output.images()).toEqual([]);
        });
    });

    describe('Type safety with generics', () => {
        it('should provide type safety with generic parameter', () => {
            interface User { name: string; age: number; }

            const results: CompletionResult[] = [
                { type: 'json', value: { name: 'Bob', age: 25 } }
            ];

            const output = InteractionOutput.from<User>(results);
            const user = output.object(); // TypeScript knows this is User

            expect(user.name).toBe('Bob');
            expect(user.age).toBe(25);
        });


        it('should allow type override at method level', () => {
            interface Person { name: string; age: number; }
            interface Address { street: string; city: string; }

            const results: CompletionResult[] = [
                { type: 'json', value: { name: 'Alice', age: 30 } },
                { type: 'json', value: { street: '123 Main', city: 'NYC' } }
            ];

            const output = InteractionOutput.from<Person>(results);
            const person = output.objectAt<Person>(0);
            const address = output.objectAt<Address>(1);

            expect(person.name).toBe('Alice');
            expect(address.city).toBe('NYC');
        });
    });
});
