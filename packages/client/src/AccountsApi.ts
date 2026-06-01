import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type { Account } from '@vertesia/common';

export default class AccountsApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/accounts');
    }

    create(name: string): Promise<Account> {
        return this.post('/', { payload: { name } });
    }

    list(): Promise<Account[]> {
        return this.get('/');
    }
}
