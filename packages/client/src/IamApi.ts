import { AccessControlEntry, ACECreatePayload, AcesQueryOptions, Permission, ProjectRoles } from "@vertesia/common";
import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";
import { GroupsApi } from "./GroupsApi.js";


export interface FilterOption {
    id: string,
    name: string,
    count: number
}


export class IamApi extends ApiTopic {

    constructor(parent: ClientBase) {
        super(parent, "/api/v1/iam")
    }

    aces = new AcesApi(this)
    roles = new RolesApi(this)
    groups = new GroupsApi(this)
}

export class RolesApi extends ApiTopic {

    constructor(parent: ClientBase) {
        super(parent, "/roles")
    }

    list(): Promise<{ name: ProjectRoles, permissions: Permission[] }[]> {
        return this.get('/');
    }

}


export class AcesApi extends ApiTopic {

    constructor(parent: ClientBase) {
        super(parent, "/aces")
    }

    /**
     * Get the list of all runs
     * @param project optional project id to filter by
     * @param interaction optional interaction id to filter by
     * @returns InteractionResult[]
     **/
    list(options: AcesQueryOptions): Promise<AccessControlEntry[]> {
        return this.get('/', { query: { ...options } });
    }

    /**
     * Get an ACE by its Id
     * @param id
     * @returns InteractionResult
     **/
    retrieve(id: string): Promise<AccessControlEntry> {
        return this.get('/' + id);
    }

    create(payload: ACECreatePayload): Promise<AccessControlEntry> {
        return this.post('/', { payload })
    }

    delete(id: string): Promise<{ id: string }> {
        return this.del('/' + id)
    }

}