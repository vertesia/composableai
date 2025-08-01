import { ApiKey, ApiKeyWithValue, CreateOrUpdateApiKeyPayload, CreatePublicKeyPayload } from "@vertesia/common";
import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";

export class ApiKeysApi extends ApiTopic {


    constructor(parent: ClientBase) {
        super(parent, "/api/v1/apikeys")
    }


    /**
     * List all keys for account without values
     * @returns ApiKey[]
     */
    list(level: 'account' | 'project' = 'account'): Promise<ApiKey[]> {
        return this.get('/', { query: { level } });
    }

    /**
     * Create an new ApiKey for account
     * BE VERY CAREFUL USING THIS API
     * ALL REQUESTS ARE LOGGED IN SECURITY AUDIT LOG
     * @returns ApiKeyWithValue
     */
    create(payload: CreateOrUpdateApiKeyPayload): Promise<ApiKeyWithValue> {
        return this.post('/', { payload });
    }

    /**
     * Update an existing ApiKey for account
     * @returns ApiKey
     */
    update(id: string, payload: CreateOrUpdateApiKeyPayload): Promise<ApiKey> {
        return this.put(`/${id}`, { payload });
    }

    /**
     * Retrieve an ApiKey and its value
     * BE VERY CAREFUL USING THIS API AS IT EXPOSE THE API KEY VALUE
     * ALL REQUESTS ARE LOGGED IN SECURITY AUDIT LOG
     * @returns ApiKeyWithValue
     * */
    retrieve(id: string, withValue: boolean = false): Promise<ApiKey | ApiKeyWithValue> {
        if (withValue) {
            return this.get(`/${id}`, { query: { withValue: true } });
        } else {
            return this.get(`/${id}`);
        }
    }

    /**
     * get or create a temporary public key which can be used from browser to browse and execute interactions.
     * If a public key already exists for the given project (or for the current organization) then it is returned, otherwise a new one is created.
     * The payload object can contain the following properties:
     * - name: the name of the public key. If not specified a random name is generated.
     * - projectId: the id of the project to which the public key will be associated.
     * If not specified the key is associated with the current organization. (i.e. account).
     * - ttl: the time to live of the public key in seconds.
     * The ttl defaults to 1h.
     * @param opts
     * @returns
     */
    requestPublicKey(payload: CreatePublicKeyPayload = {}): Promise<string> {
        return this.get('/pk', { query: payload as Record<string, string | number> });
    }
}
