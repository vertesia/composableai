import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type {
    CreateCustomRolePayload,
    CustomRoleDefinition,
    DeleteOperationResult,
    Permission,
    UpdateCustomRolePayload,
} from '@vertesia/common';

export default class AccountRolesApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/account/roles');
    }
    list(): Promise<CustomRoleDefinition[]> {
        return this.get('/');
    }
    permissions(): Promise<Permission[]> {
        return this.get('/permissions');
    }
    create(payload: CreateCustomRolePayload): Promise<CustomRoleDefinition> {
        return this.post('/', { payload });
    }
    update(name: string, payload: UpdateCustomRolePayload): Promise<CustomRoleDefinition> {
        return this.put(`/${encodeURIComponent(name)}`, { payload });
    }
    delete(name: string): Promise<DeleteOperationResult> {
        return this.del(`/${encodeURIComponent(name)}`);
    }
}
