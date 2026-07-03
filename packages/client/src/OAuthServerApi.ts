import { ClientBase, type IRequestParamsWithPayload } from '@vertesia/api-fetch-client';
import type {
    ApproveOAuthAuthorizationRequestPayload,
    CreateOAuthAuthorizationRequestPayload,
    OAuthAuthorizationDecisionResponse,
    OAuthAuthorizationRequest,
    OAuthDeviceAuthorizationRequest,
    OAuthDeviceAuthorizationResponse,
    OAuthGrantableScopesResponse,
} from '@vertesia/common';

export default class OAuthServerApi extends ClientBase {
    constructor(
        private readonly parent: ClientBase,
        baseUrl?: string,
    ) {
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

    handleResponse<T = unknown>(
        req: Request,
        res: Response,
        params: IRequestParamsWithPayload | undefined,
    ): T | Promise<T> {
        return this.parent.handleResponse<T>(req, res, params);
    }

    handleFetchResponse(req: Request, res: Response): void {
        this.parent.handleFetchResponse(req, res);
    }

    getRetryPolicy() {
        return this.parent.getRetryPolicy();
    }

    createAuthorizationRequest(payload: CreateOAuthAuthorizationRequestPayload): Promise<OAuthAuthorizationRequest> {
        return this.post('/requests', { payload });
    }

    createDeviceAuthorization(payload: OAuthDeviceAuthorizationRequest): Promise<OAuthDeviceAuthorizationResponse> {
        return this.post('/device_authorization', { payload });
    }

    retrieveDeviceRequest(userCode: string): Promise<OAuthAuthorizationRequest> {
        return this.get(`/device/${encodeURIComponent(userCode)}`);
    }

    retrieveRequest(requestId: string): Promise<OAuthAuthorizationRequest> {
        return this.get(`/requests/${requestId}`);
    }

    retrieveGrantableScopes(requestId: string, projectId: string): Promise<OAuthGrantableScopesResponse> {
        return this.get(`/requests/${requestId}/grantable-scopes`, { query: { project_id: projectId } });
    }

    approveRequest(
        requestId: string,
        payload: ApproveOAuthAuthorizationRequestPayload,
    ): Promise<OAuthAuthorizationDecisionResponse> {
        return this.post(`/requests/${requestId}/approve`, { payload });
    }

    denyRequest(requestId: string): Promise<OAuthAuthorizationDecisionResponse> {
        return this.post(`/requests/${requestId}/deny`, { payload: {} });
    }
}
