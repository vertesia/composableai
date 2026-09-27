import type * as Wire from './wire-types.generated.js';

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
export type UserGroup = Wire.UserGroup;
export type CreateUserGroupPayload = Wire.CreateUserGroupPayload;
export type UpdateUserGroupPayload = Wire.UpdateUserGroupPayload;
export type ListUserGroupsQuery = Wire.ListUserGroupsQuery;

/**
 * The group as it appears in a token payload, read by the servers' authorization layer, the clients
 * and the integration tests.
 *
 * The Mongoose projections that feed it live beside their queries in the servers, not here: a
 * `select()` string is MongoDB field-selection behaviour, and a shared one has to be the union of
 * every caller's needs. The previous one selected `description`, which token generation has never
 * emitted, and the security fields, which the resource-reference endpoint has no use for.
 */
export type UserGroupRef = Wire.UserGroupRef;

export const MEMBERS_GROUP_NAME = 'members';
