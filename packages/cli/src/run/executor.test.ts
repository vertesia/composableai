import { VertesiaClient } from '@vertesia/client';
import { describe, expect, it, vi } from 'vitest';
import { ExecutionRequest } from './executor.js';

describe('CLI model options', () => {
    it.each([undefined, '0.5'])(
        'only supplies a text option discriminator when a text flag is set (%s)',
        async (temperature) => {
            const client = new VertesiaClient({
                serverUrl: 'https://example.test',
                storeUrl: 'https://example.test',
                apikey: 'test',
            });
            const execute = vi
                .spyOn(client.interactions, 'executeByName')
                .mockResolvedValue({} as Awaited<ReturnType<typeof client.interactions.executeByName>>);
            await new ExecutionRequest(client, 'speech', {}, { model: 'gpt-4o-mini-tts', temperature }).run();
            const options = execute.mock.calls[0][1]?.config?.model_options;
            if (temperature) expect(options).toMatchObject({ _option_id: 'text-fallback', temperature: 0.5 });
            else expect(options).toBeUndefined();
        },
    );
});
