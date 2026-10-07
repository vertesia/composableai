import type { VertesiaClient } from '@vertesia/client';
import { expect, it, vi } from 'vitest';
import { ExecutionRequest } from './executor.js';

it('passes a runtime profile without replacing its options with an empty fallback object', async () => {
    const executeByName = vi.fn().mockResolvedValue({ id: 'run' });
    const client = { interactions: { executeByName } } as unknown as VertesiaClient;
    await new ExecutionRequest(
        client,
        'sys:DetectLanguage',
        {},
        { inferenceProfile: '0123456789abcdef01234567' },
    ).run();
    const payload = executeByName.mock.calls[0][1];
    expect(payload.config.inference_profile).toBe('0123456789abcdef01234567');
    expect(payload.config.model_options).toBeUndefined();
});

it('retains explicit CLI parameter overrides', async () => {
    const executeByName = vi.fn().mockResolvedValue({ id: 'run' });
    const client = { interactions: { executeByName } } as unknown as VertesiaClient;
    await new ExecutionRequest(
        client,
        'test',
        {},
        { inferenceProfile: '0123456789abcdef01234567', temperature: '0.2' },
    ).run();
    expect(executeByName.mock.calls[0][1].config.model_options.temperature).toBe(0.2);
});
