// @vitest-environment jsdom
import { type AvailableAIModel, OptionType, Providers } from '@llumiverse/common';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useModelOptions } from './useModelOptions.js';

function createClient() {
    return { environments: { listModels: vi.fn<() => Promise<AvailableAIModel[]>>() } };
}

const session = vi.hoisted(() => ({
    client: undefined as unknown as ReturnType<typeof createClient>,
    project: { id: 'project-id' },
}));

vi.mock('@vertesia/ui/session', () => ({ useUserSession: () => session }));

const NOVA_PROFILE = 'arn:aws:bedrock:us-east-1:123456789012:application-inference-profile/nova123xyz';
const HAIKU_PROFILE = 'arn:aws:bedrock:us-east-1:123456789012:application-inference-profile/haiku123xyz';
const CATALOG: AvailableAIModel[] = [
    {
        id: NOVA_PROFILE,
        name: 'Profile One',
        provider: Providers.bedrock,
        base_model_id: 'arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-pro-v1:0',
    },
    {
        id: HAIKU_PROFILE,
        name: 'Profile Two',
        provider: Providers.bedrock,
        base_model_id: 'arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-haiku-5-5',
    },
];
const ALL_TIERS = ['default', 'flex', 'priority', 'reserved'];

function useTierChoices(model: string, environmentId = 'environment-id') {
    const tier = useModelOptions(model, Providers.bedrock, undefined, environmentId).options.find(
        (option) => option.name === 'service_tier',
    );
    return tier?.type === OptionType.enum ? Object.values(tier.enum) : [];
}

beforeEach(() => {
    // The catalog cache is keyed by session client, so a new client per test starts from an empty cache.
    session.client = createClient();
});

afterEach(() => {
    cleanup();
    vi.useRealTimers();
});

describe('Bedrock profile tier choices', () => {
    it('looks up the selected profile in its environment and uses the backing model tiers', async () => {
        session.client.environments.listModels.mockResolvedValue(CATALOG);

        const { result, rerender } = renderHook(useTierChoices, { initialProps: NOVA_PROFILE });
        await waitFor(() => expect(result.current).toEqual(['default', 'flex', 'priority']));
        expect(session.client.environments.listModels).toHaveBeenCalledWith('environment-id');

        rerender(HAIKU_PROFILE);
        await waitFor(() => expect(result.current).toEqual(['default']));
    });

    it('fetches an environment catalog once for every editor and profile in it', async () => {
        session.client.environments.listModels.mockResolvedValue(CATALOG);

        const first = renderHook(() => useTierChoices(NOVA_PROFILE));
        const second = renderHook(() => useTierChoices(HAIKU_PROFILE));
        await waitFor(() => expect(first.result.current).toEqual(['default', 'flex', 'priority']));
        await waitFor(() => expect(second.result.current).toEqual(['default']));
        first.unmount();
        const reopened = renderHook(() => useTierChoices(NOVA_PROFILE));
        await waitFor(() => expect(reopened.result.current).toEqual(['default', 'flex', 'priority']));

        expect(session.client.environments.listModels).toHaveBeenCalledTimes(1);
    });

    it('fetches each environment and each session separately', async () => {
        session.client.environments.listModels.mockResolvedValue(CATALOG);
        const first = renderHook(() => useTierChoices(NOVA_PROFILE, 'environment-a'));
        const other = renderHook(() => useTierChoices(NOVA_PROFILE, 'environment-b'));
        await waitFor(() => expect(first.result.current).toEqual(['default', 'flex', 'priority']));
        await waitFor(() => expect(other.result.current).toEqual(['default', 'flex', 'priority']));
        expect(session.client.environments.listModels).toHaveBeenCalledTimes(2);

        session.client = createClient();
        session.client.environments.listModels.mockResolvedValue(CATALOG);
        const signedInAgain = renderHook(() => useTierChoices(NOVA_PROFILE, 'environment-a'));
        await waitFor(() => expect(signedInAgain.result.current).toEqual(['default', 'flex', 'priority']));
        expect(session.client.environments.listModels).toHaveBeenCalledTimes(1);
    });

    it('retries a failed lookup instead of remembering it', async () => {
        session.client.environments.listModels.mockRejectedValueOnce(new Error('throttled'));
        session.client.environments.listModels.mockResolvedValue(CATALOG);

        const failed = renderHook(() => useTierChoices(NOVA_PROFILE));
        await waitFor(() => expect(session.client.environments.listModels).toHaveBeenCalledTimes(1));
        // Let the rejection settle, which is when the failed entry leaves the cache.
        await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
        expect(failed.result.current).toEqual(ALL_TIERS);
        failed.unmount();

        const retried = renderHook(() => useTierChoices(NOVA_PROFILE));
        await waitFor(() => expect(retried.result.current).toEqual(['default', 'flex', 'priority']));
        expect(session.client.environments.listModels).toHaveBeenCalledTimes(2);
    });

    it('stays pending when returning to a profile whose earlier lookup failed', async () => {
        session.client.environments.listModels.mockRejectedValueOnce(new Error('throttled'));
        const retry = Promise.withResolvers<AvailableAIModel[]>();
        session.client.environments.listModels.mockReturnValueOnce(retry.promise);
        const { result, rerender } = renderHook(
            (model: string) => useModelOptions(model, Providers.bedrock, undefined, 'environment-id'),
            { initialProps: HAIKU_PROFILE },
        );
        await waitFor(() => expect(result.current.pending).toBe(false));

        rerender('us.amazon.nova-pro-v1:0');
        rerender(HAIKU_PROFILE);
        // The failed answer belongs to the earlier selection, so the retry is pending with the interim schema.
        expect(result.current.pending).toBe(true);
        retry.resolve(CATALOG);
        await waitFor(() => expect(result.current.pending).toBe(false));
        const tier = result.current.options.find((option) => option.name === 'service_tier');
        expect(tier?.type === OptionType.enum && Object.values(tier.enum)).toEqual(['default']);
    });

    it('fetches the catalog again once the cached copy expires', async () => {
        // Only Date is faked, so the testing library keeps polling on real timers.
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(1_000_000);
        session.client.environments.listModels.mockResolvedValue(CATALOG);
        const first = renderHook(() => useTierChoices(NOVA_PROFILE));
        await waitFor(() => expect(first.result.current).toEqual(['default', 'flex', 'priority']));
        first.unmount();

        vi.setSystemTime(1_000_000 + 5 * 60 * 1000 + 1);
        const later = renderHook(() => useTierChoices(NOVA_PROFILE));
        await waitFor(() => expect(later.result.current).toEqual(['default', 'flex', 'priority']));

        expect(session.client.environments.listModels).toHaveBeenCalledTimes(2);
    });

    it('reports a cold lookup as pending and answers a warm one on the first render', async () => {
        session.client.environments.listModels.mockResolvedValue(CATALOG);
        const cold = renderHook(() => useModelOptions(NOVA_PROFILE, Providers.bedrock, undefined, 'environment-id'));
        expect(cold.result.current.pending).toBe(true);
        await waitFor(() => expect(cold.result.current.pending).toBe(false));

        // Switching profiles in a loaded environment must never show the interim schema with every tier.
        const renders: string[][] = [];
        renderHook(() => {
            const choices = useTierChoices(HAIKU_PROFILE);
            renders.push(choices);
            return choices;
        });
        expect(renders[0]).toEqual(['default']);
        expect(session.client.environments.listModels).toHaveBeenCalledTimes(1);
    });

    it('fetches a loaded catalog again when it lacks the selected profile', async () => {
        session.client.environments.listModels.mockResolvedValueOnce(CATALOG.slice(0, 1));
        session.client.environments.listModels.mockResolvedValue(CATALOG);
        const first = renderHook(() => useTierChoices(NOVA_PROFILE));
        await waitFor(() => expect(first.result.current).toEqual(['default', 'flex', 'priority']));

        // Enabled after the catalog loaded: the first lookup misses, then the refreshed catalog answers.
        const added = renderHook(() => useModelOptions(HAIKU_PROFILE, Providers.bedrock, undefined, 'environment-id'));
        expect(added.result.current.pending).toBe(true);
        await waitFor(() => expect(added.result.current.pending).toBe(false));
        const tier = added.result.current.options.find((option) => option.name === 'service_tier');
        expect(tier?.type === OptionType.enum && Object.values(tier.enum)).toEqual(['default']);
        expect(session.client.environments.listModels).toHaveBeenCalledTimes(2);
    });

    it('uses the model ID directly for a system inference profile', () => {
        const { result } = renderHook(() => useTierChoices('us.amazon.nova-pro-v1:0'));

        expect(result.current).toEqual(['default', 'flex', 'priority']);
        expect(session.client.environments.listModels).not.toHaveBeenCalled();
        const { result: options } = renderHook(() =>
            useModelOptions('us.amazon.nova-pro-v1:0', Providers.bedrock, undefined, 'environment-id'),
        );
        expect(options.current.pending).toBe(false);
    });
});
