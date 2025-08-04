/**
 * @module access-control
 * @description
 * Access control interfaces
 */

import { ProjectRoles, AccountRoles } from "./project.js";

export enum Permission {
    int_read = "interaction:read",
    int_write = "interaction:write",
    int_delete = "interaction:delete",

    int_execute = "interaction:execute",
    run_read = "run:read",
    run_write = "run:write",

    env_admin = "environment:admin",

    project_admin = "project:admin",
    project_integration_read = "project:integration_read",
    project_settings_write = "project:settings_write",

    api_key_create = "api_key:create",
    api_key_read = "api_key:read",
    api_key_update = "api_key:update",
    api_key_delete = "api_key:delete",

    account_read = "account:read",
    account_write = "account:write",
    account_admin = "account:admin",
    manage_billing = "account:billing",
    account_member = "account:member",


    content_read = "content:read",
    content_write = "content:write",
    content_delete = "content:delete",

    content_admin = "content:admin", //manage schemas

    workflow_run = "workflow:run",
    workflow_admin = "workflow:admin",

    /**
     * whether the user has access to Sutdio App.
     */
    studio_access = "studio:access",
}

export enum AccessControlResourceType {
    project = "project",
    environment = "environment",
    account = "account",
    interaction = "interaction",
    app = "application",
}

export enum AccessControlPrincipalType {
    user = "user",
    group = "group",
}



export interface AccessControlEntry {
    role: ProjectRoles | AccountRoles;
    resource_type: AccessControlResourceType;
    resource: string; //objectId
    principal_type: AccessControlPrincipalType;
    principal: string; //objectId
    tags?: string[];
    expires_at?: string;
    created_at?: string;
    updated_at?: string;
    id: string;
}

export interface ACECreatePayload extends
    Omit<AccessControlEntry, "created_at" | "updated_at" | "id"> {
}

export interface ACEUpdatePayload extends Partial<ACECreatePayload> {
}


export interface AcesQueryOptions {

    level?: 'resource' | 'project' | 'projects' | 'account'
    resource?: string
    principal?: string
    role?: string
    type?: AccessControlResourceType

}