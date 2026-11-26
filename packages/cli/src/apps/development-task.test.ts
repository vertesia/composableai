import type { VertesiaClient } from '@vertesia/client';
import { describe, expect, it, vi } from 'vitest';
import { resolveDevelopmentTaskRuntime } from './commands.js';

function fakeClient(profile: { environment: string; model?: string } | undefined) {
    const getDefault = vi.fn(async () => profile);
    const client = {
        getProject: vi.fn(async () => ({ id: 'project-1' })),
        projects: { retrieve: vi.fn(async () => ({ id: 'project-1', configuration: { inference: {} } })) },
        inferenceProfiles: { getDefault },
    };
    return { client: client as unknown as VertesiaClient, project: client.getProject, getDefault };
}

describe('resolveDevelopmentTaskRuntime', () => {
    it('uses the flags as given without reading the project', async () => {
        const { client, project } = fakeClient(undefined);
        expect(await resolveDevelopmentTaskRuntime(client, { env: 'env-1', model: 'model-1' })).toEqual({
            environment: 'env-1',
            model: 'model-1',
        });
        expect(project).not.toHaveBeenCalled();
    });

    it('takes the environment and model of the project agent default when the flags are omitted', async () => {
        const { client, getDefault } = fakeClient({ environment: 'env-default', model: 'model-default' });
        expect(await resolveDevelopmentTaskRuntime(client, {})).toEqual({
            environment: 'env-default',
            model: 'model-default',
        });
        expect(getDefault).toHaveBeenCalledWith({ inference: {} }, 'agent');
    });

    it('treats a blank flag, such as an unset shell variable, as omitted', async () => {
        const { client } = fakeClient({ environment: 'env-default', model: 'model-default' });
        expect(await resolveDevelopmentTaskRuntime(client, { env: ' ', model: '' })).toEqual({
            environment: 'env-default',
            model: 'model-default',
        });
    });

    it('lets a flag override the default for one value only', async () => {
        const { client } = fakeClient({ environment: 'env-default', model: 'model-default' });
        expect(await resolveDevelopmentTaskRuntime(client, { model: 'model-1' })).toEqual({
            environment: 'env-default',
            model: 'model-1',
        });
    });

    it('says which flag to pass and how to find its value when the project has no default', async () => {
        const { client } = fakeClient(undefined);
        await expect(resolveDevelopmentTaskRuntime(client, {})).rejects.toThrow('pass -e <environment>');
    });

    it('names the environment to list models for when only the model is missing', async () => {
        const { client } = fakeClient({ environment: 'env-default' });
        await expect(resolveDevelopmentTaskRuntime(client, {})).rejects.toThrow('envs models env-default');
    });
});
