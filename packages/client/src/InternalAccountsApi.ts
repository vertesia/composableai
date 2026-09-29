import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type { AccountApiVersionPolicy } from '@vertesia/common';

export default class InternalAccountsApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/internal/accounts');
    }

    getApiVersionPolicy(accountId: string): Promise<AccountApiVersionPolicy> {
        return this.get(`/${encodeURIComponent(accountId)}/api-version-policy`);
    }
}
