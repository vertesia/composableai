import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../i18n/index.js';
import { UserInfo } from './UserInfo';

const { retrieveApiKey } = vi.hoisted(() => ({
    retrieveApiKey: vi.fn(),
}));

vi.mock('@vertesia/ui/session', () => ({
    useUserSession: () => ({
        client: {
            apikeys: {
                retrieve: retrieveApiKey,
            },
            iam: {
                groups: {
                    retrieve: vi.fn(),
                },
            },
            users: {
                retrieve: vi.fn(),
            },
        },
    }),
}));

describe('UserInfo', () => {
    it('renders a missing API key as an unknown principal and caches the 404', async () => {
        const error = Object.assign(new Error('Not Found'), { status: 404 });
        retrieveApiKey.mockRejectedValueOnce(error);

        render(
            <I18nProvider lng="en">
                <UserInfo userRef="apikey:missing-key-for-test" showTitle />
                <UserInfo userRef="apikey:missing-key-for-test" showTitle />
            </I18nProvider>,
        );

        await waitFor(() => {
            expect(screen.getAllByText('Unknown User')).toHaveLength(2);
        });
        expect(screen.queryByText('Failed to fetch the apikey')).toBeNull();
        expect(retrieveApiKey).toHaveBeenCalledTimes(1);
    });
});
