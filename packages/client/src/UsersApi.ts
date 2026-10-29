import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type { CreateUserPayload, DeleteByIdResult, UpdateUserPayload, User } from '@vertesia/common';

export default class UsersApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/users');
    }

    /**
     * Add a user to the current account with the member role, without sending an invitation.
     * Creates the user when no user has the address; otherwise adds the existing one, leaving its
     * profile unchanged. Repeating the call returns the same user.
     */
    create(payload: CreateUserPayload): Promise<User> {
        return this.post('', { payload });
    }

    retrieve(userId: string): Promise<User> {
        return this.get(`/${userId}`);
    }

    update(userId: string, payload: UpdateUserPayload): Promise<User> {
        return this.put(`/${userId}`, { payload });
    }

    delete(userId: string): Promise<DeleteByIdResult> {
        return this.del(`/${userId}`);
    }
}
