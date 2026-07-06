import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type {
    ACECreatePayload,
    ACEUpdatePayload,
    AccessControlEntry,
    AcesQueryOptions,
    DeleteByIdResult,
    PrincipalIdentity,
    RoleDefinition,
    SystemRoleDefinition,
} from '@vertesia/common';
import { GroupsApi } from './GroupsApi.js';

export interface FilterOption {
    id: string;
    name: string;
    count: number;
}

export class IamApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/iam');
    }

    aces = new AcesApi(this);
    roles = new RolesApi(this);
    groups = new GroupsApi(this);

    /**
     * Fetch the current user's principal identity — the id plus the merged
     * ABAC principal context (clearance, compartments, email, tags, properties).
     *
     * Rejects with HTTP 400 if the caller is not a user principal
     * (API keys, service accounts, etc. — they have no underlying user context).
     */
    getPrincipalIdentity(): Promise<PrincipalIdentity> {
        return this.get('/users/identity');
    }
}

export class RolesApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/roles');
    }

    /** List every built-in role across all partitions. Permissions are loosely typed (`string[]`). */
    list(): Promise<RoleDefinition[]> {
        return this.get('/');
    }

    /**
     * List system-domain roles only. Permissions are tightly typed as `Permission[]` —
     * suited for client-side permission gating (button visibility, route guards).
     * ABAC roles are excluded and must be consumed via the JWT `content_security` claim.
     */
    listSystem(): Promise<SystemRoleDefinition[]> {
        return this.get('/system');
    }
}

export class AcesApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/aces');
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
     * List all ACEs scoped to the current project.
     * Returns both regular project ACEs and dynamic (content_set/principal_set) ACEs.
     */
    listProjectAces(): Promise<AccessControlEntry[]> {
        return this.get('/project');
    }

    /**
     * Get an ACE by its Id
     * @param id
     * @returns InteractionResult
     **/
    retrieve(id: string): Promise<AccessControlEntry> {
        return this.get(`/${id}`);
    }

    create(payload: ACECreatePayload): Promise<AccessControlEntry> {
        return this.post('/', { payload });
    }

    update(id: string, payload: ACEUpdatePayload): Promise<AccessControlEntry> {
        return this.put(`/${id}`, { payload });
    }

    delete(id: string): Promise<DeleteByIdResult> {
        return this.del(`/${id}`);
    }
}
