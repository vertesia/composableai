import { ApiTopic, ClientBase, type IRequestParamsWithPayload } from '@vertesia/api-fetch-client';
import type {
    ApproveOAuthAuthorizationRequestPayload,
    OAuthAuthorizationDecisionResponse,
    OAuthAuthorizationRequest,
} from '@vertesia/common';
import type { VertesiaClient } from './client.js';

class TokenServerClient extends ClientBase {
    constructor(private readonly parent: VertesiaClient) {
        super(parent.tokenServerUrl, parent._fetch);
        this.createServerError = parent.createServerError;
        this.errorFactory = parent.errorFactory;
        this.verboseErrors = parent.verboseErrors;
    }

    createRequest(url: string, init: RequestInit): Promise<Request> {
        return this.parent.createRequest(url, init);
    }

    handleResponse(req: Request, res: Response, params: IRequestParamsWithPayload | undefined) {
        return this.parent.handleResponse(req, res, params);
    }

    get headers() {
        return this.parent.headers;
    }
}

export default class OAuthServerApi extends ApiTopic {
    constructor(parent: VertesiaClient) {
        super(new TokenServerClient(parent), '/oauth');
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
