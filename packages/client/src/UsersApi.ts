import { UpdateUserPayload, User } from '@vertesia/common';
import { ApiTopic, ClientBase } from '@vertesia/api-fetch-client';


export default class UsersApi extends ApiTopic {

    constructor(parent: ClientBase) {
        super(parent, '/api/v1/users')
    }

    retrieve(userId: string): Promise<User> {
        return this.get('/' + userId);
    }

    update(userId: string, payload: UpdateUserPayload): Promise<User> {
        return this.put('/' + userId, { payload });
    }

    delete(userId: string): Promise<{ id: string }> {
        return this.del('/' + userId);
    }
}
