import { ApiTopic, ClientBase } from '@vertesia/api-fetch-client';
import type {
    BulkRevokeOAuthGrantsPayload,
    ListOAuthGrantsQuery,
    OAuthGrant,
    OAuthGrantListResponse,
    OAuthGrantRevokeResponse,
} from '@vertesia/common';

function toQueryRecord(query?: ListOAuthGrantsQuery): Record<string, string> | undefined {
    if (!query) {
        return undefined;
    }

    return Object.fromEntries(
        Object.entries(query)
            .filter(([, value]) => value !== undefined)
            .map(([key, value]) => [key, String(value)]),
    );
}

export default class OAuthGrantsApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/oauth-grants');
    }

    list(query?: ListOAuthGrantsQuery): Promise<OAuthGrantListResponse> {
        return this.get('/', { query: toQueryRecord(query) });
    }

    retrieve(grantId: string): Promise<OAuthGrant> {
        return this.get(`/${grantId}`);
    }

    revoke(grantId: string, query?: { include_consent?: boolean }): Promise<OAuthGrantRevokeResponse> {
        return this.del(`/${grantId}`, { query });
    }

    revokeBulk(payload: BulkRevokeOAuthGrantsPayload): Promise<OAuthGrantRevokeResponse> {
        return this.post('/revoke', { payload });
    }
}
