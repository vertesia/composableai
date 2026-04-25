import { ClientBase, type IRequestParamsWithPayload } from '@vertesia/api-fetch-client';
import type {
    ApproveOAuthAuthorizationRequestPayload,
    CreateOAuthAuthorizationRequestPayload,
    OAuthAuthorizationDecisionResponse,
    OAuthAuthorizationRequest,
} from '@vertesia/common';

export default class OAuthServerApi extends ClientBase {
    constructor(private readonly parent: ClientBase, baseUrl?: string) {
        super(new URL('/oauth', `${baseUrl || parent.baseUrl}/`).toString(), parent._fetch);
        this.createServerError = parent.createServerError;
        this.errorFactory = parent.errorFactory;
        this.verboseErrors = parent.verboseErrors;
    }

    get headers() {
        return this.parent.headers;
    }

    createRequest(url: string, init: RequestInit): Promise<Request> {
        return this.parent.createRequest(url, init);
    }

    handleResponse(req: Request, res: Response, params: IRequestParamsWithPayload | undefined): Promise<any> {
        return this.parent.handleResponse(req, res, params);
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
