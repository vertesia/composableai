import type {
    CreateUserGroupPayloadFromSchema,
    UpdateUserGroupPayloadFromSchema,
    UserGroupFromSchema,
} from './api-schemas/group.js';
import type { UserRef } from './user.js';

/**
 * The user group and its payloads as they cross the wire.
 *
 * Derived from the schemas in `./api-schemas/group.js`, which are what OpenAPI publishes and AJV
 * compiles. The field descriptions live there too — Zod reads `.meta()`, not TSDoc.
 *
 * NOTE the timestamps are `string`, not `Date`. The document has always published them as
 * `format: date-time` strings and JSON has no date type, so the previous `Date` declaration
 * described the Mongoose document rather than the response a client parses. `IUserGroup` in
 * `@dglabs/server-common` describes what Mongo actually holds and is deliberately independent.
 */
export type UserGroup = UserGroupFromSchema;
export type CreateUserGroupPayload = CreateUserGroupPayloadFromSchema;
export type UpdateUserGroupPayload = UpdateUserGroupPayloadFromSchema;

/**
 * A group with its members resolved.
 *
 * Not a published component, and deliberately not one: `members` is `select: false` on the model, no
 * endpoint documents it on `UserGroup`, and the members listing publishes `UserRef[]` on its own
 * route instead.
 */
export interface PopulatesUserGroup extends UserGroup {
    members: UserRef[];
}

export interface UserGroupRef {
    id: string;
    name: string;
    tags?: string[];
    properties?: Record<string, unknown>;
    clearance?: number;
    compartments?: string[];
    allowed_projects?: string[];
}

export const UserGroupRefPopulate = 'id name tags description properties clearance compartments allowed_projects';

export const MEMBERS_GROUP_NAME = 'members';
