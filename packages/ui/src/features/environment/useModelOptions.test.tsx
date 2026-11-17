// @vitest-environment jsdom
import { type AvailableAIModel, OptionType, Providers } from '@llumiverse/common';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useModelOptions } from './useModelOptions.js';

const session = vi.hoisted(() => ({
    client: { environments: { listModels: vi.fn<() => Promise<AvailableAIModel[]>>() } },
    project: { id: 'project-id' },
}));

vi.mock('@vertesia/ui/session', () => ({ useUserSession: () => session }));

const NOVA_PROFILE = 'arn:aws:bedrock:us-east-1:123456789012:application-inference-profile/nova123xyz';
const HAIKU_PROFILE = 'arn:aws:bedrock:us-east-1:123456789012:application-inference-profile/haiku123xyz';

function useTierChoices(model: string) {
    const tier = useModelOptions(model, Providers.bedrock, undefined, 'environment-id').options.find(
        (option) => option.name === 'service_tier',
    );
    return tier?.type === OptionType.enum ? Object.values(tier.enum) : [];
}

afterEach(() => {
    cleanup();
    vi.resetAllMocks();
});

describe('Bedrock profile tier choices', () => {
    it('looks up the selected profile in its environment and uses the backing model tiers', async () => {
        session.client.environments.listModels.mockResolvedValue([
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
        ]);

        const { result, rerender } = renderHook(useTierChoices, { initialProps: NOVA_PROFILE });
        await waitFor(() => expect(result.current).toEqual(['default', 'flex', 'priority']));
        expect(session.client.environments.listModels).toHaveBeenCalledWith('environment-id', { text: NOVA_PROFILE });

        rerender(HAIKU_PROFILE);
        await waitFor(() => expect(result.current).toEqual(['default']));
        expect(session.client.environments.listModels).toHaveBeenLastCalledWith('environment-id', {
            text: HAIKU_PROFILE,
        });
    });

    it('uses the model ID directly for a system inference profile', () => {
        const { result } = renderHook(() => useTierChoices('us.amazon.nova-pro-v1:0'));

        expect(result.current).toEqual(['default', 'flex', 'priority']);
        expect(session.client.environments.listModels).not.toHaveBeenCalled();
    });
});
