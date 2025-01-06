import { Account } from "@vertesia/common";
import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";

export default class AccountsApi extends ApiTopic {

    constructor(parent: ClientBase) {
        super(parent, "/api/v1/accounts")
    }

    create(name: string): Promise<Account> {
        return this.post('/', { payload: { name } });
    }





}
