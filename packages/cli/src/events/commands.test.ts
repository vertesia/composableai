import { Command } from 'commander';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEventSubscription, updateEventSubscription } from './commands.js';

const mocks = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), readJsonFile: vi.fn() }));
vi.mock('../client.js', () => ({
    getClient: async () => ({ store: { events: { subscriptions: mocks } } }),
}));
vi.mock('../utils/stdio.js', () => ({ readJsonFile: mocks.readJsonFile, writeFile: vi.fn() }));
afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
});

describe('event subscription CLI', () => {
    it('passes full replacement and media settings through create, retaining immutable identity on update', async () => {
        vi.spyOn(console, 'log').mockImplementation(() => undefined);
        const payload = {
            name: 'Low intake',
            overrides_system_subscription_id: 'sys:StandardIntake',
            filter: {},
            run_as_role: 'automation',
            target: {
                type: 'workflow',
                endpoint: 'StandardIntake',
                vars: {
                    media_analysis: {
                        image: { interaction: 'custom:Image', config: { inference_profile: 'image-profile' } },
                    },
                },
            },
        };
        mocks.readJsonFile.mockReturnValue(payload);
        mocks.create.mockResolvedValue({ subscription: { id: 'subscription-1' } });
        mocks.update.mockResolvedValue({ subscription: { id: 'subscription-1' } });
        await createEventSubscription(new Command(), { file: 'intake.json' });
        expect(mocks.create).toHaveBeenCalledWith(payload);
        await updateEventSubscription(new Command(), 'subscription-1', { file: 'intake.json' });
        const { overrides_system_subscription_id: _immutable, ...update } = payload;
        expect(mocks.update).toHaveBeenCalledWith('subscription-1', update);
    });
});

it.each([42, ['sys:StandardIntake'], {}, null])(
    'rejects malformed replacement identity %j without creating an additive subscription',
    async (id) => {
        mocks.readJsonFile.mockReturnValue({
            name: 'Intake',
            filter: {},
            target: { type: 'workflow', endpoint: 'StandardIntake' },
            run_as_role: 'automation',
            overrides_system_subscription_id: id,
        });
        await expect(createEventSubscription(new Command(), { file: 'intake.json' })).rejects.toThrow(
            'overrides_system_subscription_id must be a string',
        );
        expect(mocks.create).not.toHaveBeenCalled();
    },
);
