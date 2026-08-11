import type { z } from 'zod';
/**
 * @module access-control
 * @description
 * Access control interfaces
 */

import type { AccessControlResourceType } from './access-control-values.js';
import type {
    ACECreatePayloadSchema,
    ACEUpdatePayloadSchema,
    AccessControlEntrySchema,
    AceConditionsSchema,
    PropertyConditionsSchema,
    PropertyConditionValueSchema,
} from './api-schemas/access-control.js';

/**
 * The enums live in `./access-control-values.js` so the API schemas can consume them without
 * importing this module back. Re-exported here so every existing import path keeps working.
 */
export * from './access-control-values.js';

/**
 * MongoDB query syntax subset for matching properties.
 * Keys are property names, values are either direct match values or operator objects.
 * Supported operators: `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`, `$exists`, `$empty`, `$like`.
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
export type PropertyConditionValue = z.infer<typeof PropertyConditionValueSchema>;
export type PropertyConditions = z.infer<typeof PropertyConditionsSchema>;

/**
 * The access-control wire types, inferred from the schemas in `./api-schemas/access-control.js` —
 * which are what OpenAPI publishes and AJV compiles. The field descriptions live there too, since
 * Zod reads `.meta()` and not TSDoc.
 *
 * NOTE `conditions` carries ONLY the three fields it declares. The server stores two more there —
 * `principal_name` / `resource_name`, see `IAceConditions` in `@dglabs/server-common` — and copies
 * them into `principal` / `resource` on the way out. They are not part of this contract, and the
 * response mappers drop them rather than serializing the sub-document.
 */
export type AceConditions = z.infer<typeof AceConditionsSchema>;
export type AccessControlEntry = z.infer<typeof AccessControlEntrySchema>;
export type ACECreatePayload = z.infer<typeof ACECreatePayloadSchema>;
export type ACEUpdatePayload = z.infer<typeof ACEUpdatePayloadSchema>;

/** Human-readable labels for each security level, indexed by numeric value. */
export const SecurityLevelLabels: readonly string[] = ['Public', 'Internal', 'Confidential', 'Restricted', 'Secret'];

export interface AcesQueryOptions {
    level?: 'resource' | 'project' | 'projects' | 'account';
    resource?: string;
    principal?: string;
    role?: string;
    type?: AccessControlResourceType;
}
