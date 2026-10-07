import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type {
    AccountApiKey,
    AccountApiKeyWithValue,
    CreateAccountApiKeyPayload,
    DeleteOperationResult,
    UpdateAccountApiKeyPayload,
} from '@vertesia/common';

export default class AccountApiKeysApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/account/apikeys');
    }
    list(): Promise<AccountApiKey[]> {
        return this.get('/');
    }
    retrieve(id: string): Promise<AccountApiKey> {
        return this.get(`/${id}`);
    }
    create(payload: CreateAccountApiKeyPayload): Promise<AccountApiKeyWithValue> {
        return this.post('/', { payload });
    }
    update(id: string, payload: UpdateAccountApiKeyPayload): Promise<AccountApiKey> {
        return this.put(`/${id}`, { payload });
    }
    delete(id: string): Promise<DeleteOperationResult> {
        return this.del(`/${id}`);
    }
}
