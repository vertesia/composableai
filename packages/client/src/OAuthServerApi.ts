import { ClientBase, type IRequestParamsWithPayload } from '@vertesia/api-fetch-client';
import type {
    ApproveOAuthAuthorizationRequestPayload,
    CreateOAuthAuthorizationRequestPayload,
    OAuthAuthorizationDecisionResponse,
    OAuthAuthorizationRequest,
    OAuthDeviceAuthorizationRequest,
    OAuthDeviceAuthorizationResponse,
    OAuthGrantableScopesResponse,
    OAuthLoginDecisionResponse,
    OAuthLoginPayload,
    OAuthTokenExchangeRequest,
    OAuthTokenExchangeResponse,
    ProjectRef,
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

    /** Exchange a signed IdP assertion; optional client authentication follows the connection policy. */
    exchangeToken(
        payload: OAuthTokenExchangeRequest,
        basic?: { client_id: string; client_secret: string },
    ): Promise<OAuthTokenExchangeResponse> {
        if (
            basic &&
            (payload.client_secret !== undefined ||
                payload.client_assertion !== undefined ||
                (payload.client_id !== undefined && payload.client_id !== basic.client_id))
        )
            throw new Error('Use exactly one client authentication method');
        return this.post('/token', {
            payload,
            ...(basic
                ? {
                      headers: {
                          Authorization: `Basic ${btoa(`${encodeURIComponent(basic.client_id)}:${encodeURIComponent(basic.client_secret)}`)}`,
                      },
                  }
                : {}),
        });
    }

    login(requestId: string, payload: OAuthLoginPayload): Promise<OAuthLoginDecisionResponse> {
        return this.post(`/requests/${encodeURIComponent(requestId)}/login`, { payload });
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

    createAuthorizationRequest(
        payload: CreateOAuthAuthorizationRequestPayload,
        authorizationServerPath?: string,
    ): Promise<OAuthAuthorizationRequest> {
        if (!authorizationServerPath) {
            return this.post('/requests', { payload });
        }
        if (!/^\/env\/[a-z][a-z0-9-]{1,15}\/dev-[a-z0-9-]+$/.test(authorizationServerPath)) {
            return Promise.reject(new Error('Invalid OAuth authorization server path'));
        }
        const url = new URL(`${authorizationServerPath}/requests`, this.baseUrl).toString();
        return this.post(url, { payload });
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

    retrieveGrantableProjects(requestId: string): Promise<ProjectRef[]> {
        return this.get(`/requests/${encodeURIComponent(requestId)}/grantable-projects`);
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
