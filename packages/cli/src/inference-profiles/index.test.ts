import { Command } from 'commander';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerInferenceProfilesCommand } from './index.js';

const mocks = vi.hoisted(() => ({ usage: vi.fn(), update: vi.fn(), assign: vi.fn(), retrieve: vi.fn() }));
vi.mock('../client.js', () => ({
    getClient: async () => ({
        inferenceProfiles: mocks,
        interactions: { update: mocks.update },
        interactionConfigurations: { update: mocks.assign },
        environments: { retrieve: mocks.retrieve },
    }),
}));
afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
});
async function command(...args: string[]) {
    const program = new Command();
    registerInferenceProfilesCommand(program);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await program.parseAsync(['inference-profiles', ...args], { from: 'user' });
}
describe('inference-profiles CLI', () => {
    it('forwards usage filters and rejects invalid pagination', async () => {
        await command('usage', 'id', '--kind', 'system', '--offset', '25', '--limit', '10');
        expect(mocks.usage).toHaveBeenCalledWith('id', { kind: 'system', offset: 25, limit: 10 });
        await expect(command('usage', 'id', '--limit', '-1')).rejects.toThrow('Invalid offset');
        expect(mocks.usage).toHaveBeenCalledTimes(1);
    });
    it('clears code assignments without modifying stored interactions', async () => {
        await command('assign', 'sys:DetectLanguage', 'null');
        expect(mocks.assign).toHaveBeenCalledWith('sys:DetectLanguage', { inference_profile: null });
        expect(mocks.update).not.toHaveBeenCalled();
    });
    it('uses the environment default model for parameter discovery', async () => {
        mocks.retrieve.mockResolvedValue({ provider: 'openai', default_model: 'gpt-4o' });
        await command('parameters', 'environment');
        const result = JSON.parse(vi.mocked(console.log).mock.calls[0][0]);
        expect(result.model).toBe('gpt-4o');
        expect(result._option_id).toBeTruthy();
    });
});
