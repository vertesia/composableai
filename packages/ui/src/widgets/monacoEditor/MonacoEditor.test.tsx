// @vitest-environment jsdom
import { cleanup, render, waitFor } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MonacoEditor } from './MonacoEditor.js';

const mocks = vi.hoisted(() => ({
    runtime: {} as Record<string, unknown>,
    mounted: vi.fn(),
    diagnostics: vi.fn<(options: { schemas: { fileMatch: string[]; schema: object }[] }) => void>(),
    editor: { getValue: () => '{}', setValue: vi.fn(), hasTextFocus: () => false },
}));
vi.mock('@vertesia/ui/core', () => ({ useTheme: () => ({ theme: 'light' }) }));
vi.mock('./loadMonaco.js', () => ({
    loadMonacoReact: async () => ({
        Editor: ({ onMount }: { onMount: (editor: typeof mocks.editor, runtime: typeof mocks.runtime) => void }) => {
            const initialMount = useRef(onMount);
            useEffect(() => {
                initialMount.current(mocks.editor, mocks.runtime);
                mocks.mounted();
            }, []);
            return <div />;
        },
    }),
}));

beforeEach(() => {
    mocks.runtime = { json: { jsonDefaults: { setDiagnosticsOptions: mocks.diagnostics } } };
});
afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});
const schema = { type: 'object', properties: { media_analysis: { type: 'object' } } };
const latestSchemas = () => mocks.diagnostics.mock.lastCall?.[0].schemas;

describe('Monaco JSON schema registration', () => {
    it.each(['current', 'legacy'])('configures the %s JSON runtime API', async (version) => {
        if (version === 'legacy') {
            mocks.runtime = { languages: { json: { jsonDefaults: { setDiagnosticsOptions: mocks.diagnostics } } } };
        }
        render(<MonacoEditor language="json" path="variables.json" jsonSchema={schema} />);
        await waitFor(() =>
            expect(latestSchemas()).toEqual([expect.objectContaining({ fileMatch: ['variables.json'], schema })]),
        );
    });

    it('updates a schema arriving after mount without losing another editor schema', async () => {
        const conditionSchema = { type: 'object', properties: { and: { type: 'array' } } };
        const view = (variablesSchema?: object) => (
            <>
                <MonacoEditor language="json" path="condition.json" jsonSchema={conditionSchema} />
                <MonacoEditor language="json" path="variables.json" jsonSchema={variablesSchema} />
            </>
        );
        const mounted = render(view());
        await waitFor(() => expect(latestSchemas()).toHaveLength(1));
        mounted.rerender(view(schema));
        await waitFor(() =>
            expect(latestSchemas()).toEqual([
                expect.objectContaining({ fileMatch: ['condition.json'], schema: conditionSchema }),
                expect.objectContaining({ fileMatch: ['variables.json'], schema }),
            ]),
        );
        mounted.rerender(view({ type: 'object', additionalProperties: false }));
        await waitFor(() =>
            expect(latestSchemas()?.[1].schema).toEqual({
                type: 'object',
                additionalProperties: false,
            }),
        );
    });

    it('allocates a scoped model when a schema arrives without an explicit model path', async () => {
        const mounted = render(<MonacoEditor language="json" />);
        await waitFor(() => expect(mocks.mounted).toHaveBeenCalled());
        mounted.rerender(<MonacoEditor language="json" jsonSchema={schema} />);
        await waitFor(() =>
            expect(latestSchemas()).toEqual([
                expect.objectContaining({
                    fileMatch: [expect.stringMatching(/^inmemory:\/\/vertesia\/json\//)],
                    schema,
                }),
            ]),
        );
        mounted.unmount();
        expect(latestSchemas()).toEqual([]);
    });
});
