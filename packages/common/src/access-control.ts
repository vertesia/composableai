/**
 * @module access-control
 * @description
 * Access control interfaces
 */

import { ProjectRoles } from "./project.js";

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
    /** View cost and usage analytics */
    billing_read = "billing:read",
    account_member = "account:member",


    content_read = "content:read",
    content_write = "content:write",
    content_delete = "content:delete",
    content_admin = "content:admin", //manage schemas
    content_superadmin = "content:superadmin", // list all objects and collections


    workflow_run = "workflow:run",
    workflow_admin = "workflow:admin",
    workflow_superadmin = "workflow:superadmin",

    iam_impersonate = "iam:impersonate",

    /** whether the user has access to Sutdio App. */
    studio_access = "studio:access",
}

export enum AccessControlResourceType {
    project = "project",
    environment = "environment",
    account = "account",
    interaction = "interaction",
    app = "application",
    /** Dynamic resource matching by content properties at query time. */
    content_set = "content_set",
}

export enum AccessControlPrincipalType {
    user = "user",
    group = "group",
    apikey = "apikey",
    /** Dynamic principal matching by user/group properties at token time. */
    principal_set = "principal_set",
}



/**
 * MongoDB query syntax subset for matching properties.
 * Keys are property names, values are either direct match values or operator objects.
 * Supported operators: `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`, `$exists`.
 *
 * In `resource_props`, values can reference principal properties using the `$principal.` prefix.
 * These are resolved at token time by substituting the user's merged property value.
 * If the referenced property is missing, a type-appropriate default is used (0, "", false).
 *
 * @example
 * { department: "engineering" }                              // exact match (literal)
 * { level: { $gte: 5 } }                                    // comparison (literal)
 * { region: { $in: ["us-east", "eu-west"] } }               // set membership (literal)
 * { security_level: { $lte: "$principal.access_level" } }   // cross-reference (resolved at token time)
 */
export type PropertyConditions = Record<string, string | number | boolean | Record<string, any>>;

/**
 * Conditions attached to an ACE for dynamic matching.
 * - `principal_props`: matched against user/group properties at token time (PrincipalSet).
 * - `resource_props`: matched against content properties at query time (ContentSet).
 */
export interface AceConditions {
    /** Property conditions matched against user/group properties at token time (PrincipalSet). */
    principal_props?: PropertyConditions;
    /** Property conditions matched against content properties at query time (ContentSet). */
    resource_props?: PropertyConditions;
}

export interface AccessControlEntry {
    role: ProjectRoles;
    resource_type: AccessControlResourceType;
    resource: string; //objectId
    principal_type: AccessControlPrincipalType;
    principal: string; //objectId
    /** Account scope — required for principal_set/content_set ACEs. */
    account?: string;
    /** Project scope — narrows a principal_set/content_set ACE to a single project. */
    project?: string;
    /** Dynamic matching conditions for principal_set/content_set ACEs. */
    conditions?: AceConditions;
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
