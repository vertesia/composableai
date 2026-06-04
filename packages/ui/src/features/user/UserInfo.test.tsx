import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../i18n/index.js';
import { UserInfo } from './UserInfo';

const { retrieveApiKey, retrieveGroup, retrieveUser } = vi.hoisted(() => ({
    retrieveApiKey: vi.fn(),
    retrieveGroup: vi.fn(),
    retrieveUser: vi.fn(),
}));

vi.mock('@vertesia/ui/session', () => ({
    useUserSession: () => ({
        client: {
            apikeys: {
                retrieve: retrieveApiKey,
            },
            iam: {
                groups: {
                    retrieve: retrieveGroup,
                },
            },
            users: {
                retrieve: retrieveUser,
            },
        },
    }),
}));

describe('UserInfo', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders an API key principal without fetching the key document', () => {
        render(
            <I18nProvider lng="en">
                <UserInfo userRef="apikey:missing-key-for-test" showTitle />
                <UserInfo userRef="apikey:missing-key-for-test" showTitle />
            </I18nProvider>,
        );

        expect(screen.getAllByText('Private Key ~r-test')).toHaveLength(2);
        expect(screen.queryByText('Failed to fetch the apikey')).toBeNull();
        expect(retrieveApiKey).not.toHaveBeenCalled();
    });

    it('renders a missing user as an unknown principal and caches the 404', async () => {
        const error = Object.assign(new Error('Not Found'), { status: 404 });
        retrieveUser.mockRejectedValueOnce(error);

        render(
            <I18nProvider lng="en">
                <UserInfo userRef="user:missing-user-for-test" showTitle />
                <UserInfo userRef="user:missing-user-for-test" showTitle />
            </I18nProvider>,
        );

        await waitFor(() => {
            expect(screen.getAllByText('Unknown User')).toHaveLength(2);
        });
        expect(screen.queryByText('Failed to fetch user')).toBeNull();
        expect(retrieveUser).toHaveBeenCalledTimes(1);
    });

    it('renders a missing group as an unknown principal and caches the 404', async () => {
        const error = Object.assign(new Error('Not Found'), { status: 404 });
        retrieveGroup.mockRejectedValueOnce(error);

        render(
            <I18nProvider lng="en">
                <UserInfo userRef="group:missing-group-for-test" showTitle />
                <UserInfo userRef="group:missing-group-for-test" showTitle />
            </I18nProvider>,
        );

        await waitFor(() => {
            expect(screen.getAllByText('Unknown User')).toHaveLength(2);
        });
        expect(screen.queryByText('Failed to fetch group')).toBeNull();
        expect(retrieveGroup).toHaveBeenCalledTimes(1);
    });
});
