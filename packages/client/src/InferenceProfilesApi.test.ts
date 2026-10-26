import { describe, expect, it, vi } from 'vitest';
import { VertesiaClient } from './client.js';

describe('profile defaults', () => {
    it('resolves category IDs before base IDs and returns profile parameters', async () => {
        const client = new VertesiaClient({
            serverUrl: 'https://api.example.com',
            storeUrl: 'https://api.example.com',
        });
        const profile = {
            id: '507f1f77bcf86cd799439011',
            project: 'project',
            name: 'Agent',
            environment: 'env',
            model: 'model',
            model_options: { _option_id: 'text-fallback' as const, temperature: 0.3 },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        const retrieve = vi.spyOn(client.inferenceProfiles, 'retrieve').mockResolvedValue(profile);
        const configuration = { inference: { default_profile: 'base', system: { agent: profile.id } } };
        expect(await client.inferenceProfiles.getDefault(configuration, 'agent')).toEqual(profile);
        expect(retrieve).toHaveBeenLastCalledWith(profile.id);
        await client.inferenceProfiles.getDefault(configuration, 'intake');
        expect(retrieve).toHaveBeenLastCalledWith('base');
    });
    it('supports projects awaiting migration without requesting a profile', async () => {
        const client = new VertesiaClient({
            serverUrl: 'https://api.example.com',
            storeUrl: 'https://api.example.com',
        });
        const retrieve = vi.spyOn(client.inferenceProfiles, 'retrieve');
        const defaults = {
            base: { environment: 'env', model: 'base' },
            system: { agent: { environment: 'env', model: 'agent' } },
        };
        expect(await client.inferenceProfiles.getDefault({ defaults }, 'agent')).toEqual(defaults.system.agent);
        expect(await client.inferenceProfiles.getDefault({ defaults }, 'intake')).toEqual(defaults.base);
        expect(await client.inferenceProfiles.getDefault({})).toBeUndefined();
        expect(retrieve).not.toHaveBeenCalled();
    });
});
