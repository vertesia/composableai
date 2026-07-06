import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type {
    Account,
    AccountProjectsResponse,
    InviteAcceptanceResponse,
    InviteDeclineResponse,
    InviteUserRequestPayload,
    InviteUserResponsePayload,
    OnboardingStatus,
    ProjectRef,
    StripeBillingStatusResponse,
    TransientToken,
    UpdateAccountPayload,
    User,
    UserInviteTokenData,
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
     * @returns UserInviteTokenData[]
     * */
    listInvites(): Promise<TransientToken<UserInviteTokenData>[]> {
        return this.get('/invites');
    }
    /**
     * Fetch Invites for specific account or project
     * @param type Filter for the type of invitation, either "project" or "account"
     * @returns UserInviteTokenData[]
     * */
    listInvitation(type: 'project' | 'account' = 'project'): Promise<TransientToken<UserInviteTokenData>[]> {
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
     * Get onboarding status (completion flag + per-step progress) for the current account.
     */
    onboardingStatus(): Promise<OnboardingStatus> {
        return this.get('/onboarding');
    }

    /**
     * Explicitly mark onboarding as completed for the current account.
     */
    completeOnboarding(): Promise<OnboardingStatus> {
        return this.post('/onboarding/complete');
    }

    /**
     * Restart onboarding for the current account (account admins only).
     */
    restartOnboarding(): Promise<OnboardingStatus> {
        return this.post('/onboarding/restart');
    }

    getStripeBillingStatus(): Promise<StripeBillingStatusResponse> {
        return this.get('/stripe-billing-status');
    }
}
