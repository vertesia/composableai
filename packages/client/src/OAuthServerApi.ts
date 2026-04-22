import { ApiTopic } from '@vertesia/api-fetch-client';
import type {
    ApproveOAuthAuthorizationRequestPayload,
    CreateOAuthAuthorizationRequestPayload,
    OAuthAuthorizationDecisionResponse,
    OAuthAuthorizationRequest,
} from '@vertesia/common';
import type { ClientBase } from '@vertesia/api-fetch-client';

export default class OAuthServerApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/oauth');
    }

    createAuthorizationRequest(payload: CreateOAuthAuthorizationRequestPayload): Promise<OAuthAuthorizationRequest> {
        return this.post('/requests', { payload });
    }

    retrieveRequest(requestId: string): Promise<OAuthAuthorizationRequest> {
        return this.get(`/requests/${requestId}`);
    }

    approveRequest(requestId: string, payload: ApproveOAuthAuthorizationRequestPayload): Promise<OAuthAuthorizationDecisionResponse> {
        return this.post(`/requests/${requestId}/approve`, { payload });
    }

    denyRequest(requestId: string): Promise<OAuthAuthorizationDecisionResponse> {
        return this.post(`/requests/${requestId}/deny`, { payload: {} });
    }
}
