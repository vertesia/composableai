import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type {
    Account,
    AccountProjectsResponse,
    InviteAcceptanceResponse,
    InviteDeclineResponse,
    InviteUserRequestPayload,
    InviteUserResponsePayload,
    OnboardingProgress,
    ProjectRef,
    StripeBillingStatusResponse,
    UpdateAccountPayload,
    User,
    UserInviteToken,
} from '@vertesia/common';

export default class AccountApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/account');
    }

    /**
     * Retrieve all account information for current account
     * @returns Account[]
     */
    info(): Promise<Account> {
        return this.get('/');
    }

    /**
     * Update account information
     * @returns Account
     */
    update(payload: UpdateAccountPayload): Promise<Account> {
        return this.put('/', { payload });
    }

    /**
     * Get all projects for account
     */
    projects(): Promise<ProjectRef[]> {
        return this.get<AccountProjectsResponse>('/projects').then((res) => res.data);
    }

    members(): Promise<User[]> {
        return this.get('/members');
    }

    /**
     * Invite User to account
     */
    inviteUser(payload: InviteUserRequestPayload): Promise<InviteUserResponsePayload> {
        return this.post('/invites', { payload });
    }

    /**
     * Fetch Invites for Principal
     *
     * Returns `UserInviteToken[]`, not `TransientToken<UserInviteTokenData>[]`. The latter declared
     * `Date` for `expires`, `created_at` and `updated_at`, which no HTTP response can carry — the
     * client hands back whatever `JSON.parse` produced, so those three were always strings. It now
     * says so.
     */
    listInvites(): Promise<UserInviteToken[]> {
        return this.get('/invites');
    }
    /**
     * Fetch Invites for specific account or project
     * @param type Filter for the type of invitation, either "project" or "account"
     */
    listInvitation(type: 'project' | 'account' = 'project'): Promise<UserInviteToken[]> {
        return this.get(`/invites/${type}`);
    }

    /**
     * Accept Invite for account
     * @returns InviteAcceptanceResponse
     * */
    acceptInvite(id: string): Promise<InviteAcceptanceResponse> {
        return this.put(`/invites/${id}`);
    }

    /**
     * Delete Invite for account
     * @returns InviteDeclineResponse
     * */
    rejectInvite(id: string): Promise<InviteDeclineResponse> {
        return this.del(`/invites/${id}`);
    }

    /**
     * Get Onboarding Progress for account
     */
    onboardingProgress(): Promise<OnboardingProgress> {
        return this.get('/onboarding');
    }

    getStripeBillingStatus(): Promise<StripeBillingStatusResponse> {
        return this.get('/stripe-billing-status');
    }
}
