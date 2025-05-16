/**
 * Base interface for all domain objects in the system.
 * Provides common properties shared across all business entities.
 */
export interface BaseObject {
    /** Unique identifier for the object */
    id: string;

    /** Human-readable name or title */
    name: string;

    /** Optional detailed description of the object */
    description?: string;

    /** Optional array of categorization tags */
    tags?: string[];

    /** Identifier of the user who last modified the object */
    updated_by: string;

    /** Identifier of the user who created the object */
    created_by: string;

    /** ISO timestamp of when the object was created */
    created_at: string;

    /** ISO timestamp of when the object was last updated */
    updated_at: string;

}