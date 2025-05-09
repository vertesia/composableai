import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";
import { Account, InviteUserRequestPayload, InviteUserResponsePayload, OnboardingProgress, ProjectRef, StripeBillingStatusResponse, TransientToken, UpdateAccountPayload, User, UserInviteTokenData } from "@vertesia/common";

export default class AccountApi extends ApiTopic {

    constructor(parent: ClientBase) {
        super(parent, "/api/v1/account")
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
        return this.get('/projects').then(res => res.data);
    }

    members(): Promise<User[]> {
        return this.get('/members')
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
     * Fetch Invites for Account
     * @returns UserInviteTokenData[]
     * */
    listAccountInvitation(id: string): Promise<TransientToken<UserInviteTokenData>[]> {
        return this.get(`/invites/${id}`);
    }

    /**
     * Accept Invite for account
     * @returns UserInviteTokenData
     * */
    acceptInvite(id: string): Promise<UserInviteTokenData> {
        return this.put(`/invites/${id}`);
    }

    /**
     * Delete Invite for account
     * @returns UserInviteTokenData
     * */
    rejectInvite(id: string): Promise<UserInviteTokenData> {
        return this.delete(`/invites/${id}`);
    }

    /**
     * Get Onboarding Progress for account
     */
    onboardingProgress(): Promise<OnboardingProgress> {
        return this.get('/onboarding');
    }

    /**
     * Get a google auth token for the current project.
     * This token can be used to access exposed google cloud services
     * @returns
     */
    getGoogleToken(): Promise<{ principal: string, token: string }> {
        return this.get('/google-token');
    }

    getStripeBillingStatus(): Promise<StripeBillingStatusResponse> {
        return this.get('/stripe-billing-status')
    }

}
