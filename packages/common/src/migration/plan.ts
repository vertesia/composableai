/**
 * MigrationPlan — the contract between the planner (TS) and the runners
 * (Node Phase 1 + Go Phase 2).
 *
 * Both runtimes consume this exact JSON shape. Field names are snake_case
 * to match the persisted Mongo / Go-bson form one-to-one. Don't introduce
 * camelCase aliases — the JSON shape IS the wire format.
 *
 * The Go struct lives at apps/vertesia-migrate/internal/plan/plan.go and
 * is regenerated from this file (or kept in sync via a fixture test).
 */

import type { SourceKind } from './source-kinds.js';

export interface MigrationPlan {
    id: string;
    project_id: string;
    name: string;
    description?: string;
    source: MigrationSource;
    target: MigrationTarget;
    mapping: MigrationMapping;
    execution: MigrationExecution;
    /** Total source-side row count, frozen at planner time. Used by the
     *  guardrail that refuses to run a Node plan past NODE_CEILING. */
    count?: number;
    status: MigrationPlanStatus;
    created_at: string;
    updated_at: string;
}

export type MigrationPlanStatus =
    | 'draft'
    | 'ready'
    | 'queued'
    | 'awaiting_runner' // runner=go, waiting for the customer to dispatch
    | 'running'
    | 'paused'
    | 'completed'
    | 'completed_with_errors'
    | 'failed'
    | 'cancelled';

export interface MigrationSource {
    kind: SourceKind;
    /** Stable identifier for THIS specific upstream — a CMIS connection
     *  id, FileNet Object Store name, SharePoint site id, Drive customer
     *  id, etc. Used to compose the per-record idempotency key alongside
     *  source-type-id and source-id. The planner MUST set this so two
     *  different upstreams using the same source id values can't collide
     *  in content_objects. See docs/architecture.md "Idempotency key". */
    namespace: string;
    /** Adapter-specific connection map. Secrets are referenced by id, never
     *  inlined — the runner resolves them through EncryptedSecret. */
    connection: Record<string, unknown>;
    /** Adapter-specific tuning the planner can pass through. */
    options?: Record<string, unknown>;
    /** Whole-source filter expression in the adapter's native dialect. */
    filter?: string;
    /** Hard cap on total requests-per-second across all readers for this
     *  source. HTTP sources MUST set this — see docs/source-systems.md. */
    rate_limit?: number;
    /** Hard cap on in-flight requests. HTTP adapters default to 4 when 0. */
    max_concurrency?: number;
}

export interface MigrationTarget {
    account_id: string;
    project_id: string;
    /** "staged" = write BSON batches to GCS, drain via ingester. Default.
     *  "direct" = write to Vertesia Mongo directly. Smoke-test only. */
    sink_mode: 'staged' | 'direct';
    staging?: StagingTarget;
    /** Intentionally no `mongo_url` field — the Vertesia Mongo connection
     *  string is operational config the runner resolves from its
     *  environment (VERTESIA_MONGO_URI). Plans are stored, shared with
     *  agents, and copied across runtimes; raw Atlas URIs don't belong
     *  in any of those places. */
}

export interface StagingTarget {
    bucket: string;
    /** Defaults to <env>/<account_id>/<plan_id>/ — see wire.ts. */
    prefix?: string;
}

export interface MigrationMapping {
    /** Source-type-id → Vertesia-type mapping. */
    types: Record<string, TypeMapping>;
    acl: ACLMapping;
    content: ContentMapping;
}

export interface TypeMapping {
    target_type_id: string;
    /** Per-property mapping keyed by source property id. */
    properties?: Record<string, PropertyMapping>;
    /** Synthetic fields composed from multiple sources via transform ops.
     *  Run after the per-property pass; later writes overwrite earlier ones. */
    computed?: Record<string, ComputedField>;
    /** Type-narrowed filter in the source's native dialect. */
    filter?: string;
}

export type TargetKind = 'top' | 'properties' | 'drop';

export interface PropertyMapping {
    target_field: string;
    target_kind: TargetKind;
    /** Named transform from the registry — see docs/source-systems.md and the
     *  vertesia-migrate-transforms skill for the catalogue. */
    transform?: string;
    /** Default value substituted when the source value is null/undefined
     *  before the transform runs. */
    default?: unknown;
    /** Transform-specific args. */
    args?: Record<string, unknown>;
}

export interface ComputedField {
    target_field: string;
    target_kind: TargetKind;
    /** Op name from the transform registry (concat, format, coalesce, …). */
    op: string;
    /** Resolved against the source object at run time. Either a single
     *  source property name, an array of property names / literals, or a
     *  more complex spec — the runner's resolver handles all forms. */
    sources?: unknown;
    args?: Record<string, unknown>;
}

export interface ACLMapping {
    /** "copy" = preserve source ACEs in Vertesia ACL form.
     *  "flatten_to_project" = drop per-doc ACLs, rely on project access.
     *  "drop" = no ACL applied. */
    strategy: 'copy' | 'flatten_to_project' | 'drop';
    /** DEPRECATED — use principal_map. Kept for back-compat with early
     *  Phase 1 plans. */
    roles?: Record<string, string>;
    /**
     * Maps a source principal name (Nuxeo `ace.user`, FileNet
     * `Grantee_Name`, …) to a structured Vertesia principal reference.
     * Required for strategy="copy" — source systems typically store
     * principals as bare strings without distinguishing user vs group,
     * so the planner must classify them explicitly. The discovery tool
     * surfaces every distinct principal seen in ACEs; the agent fills
     * this map by cross-referencing the customer's Vertesia user /
     * group catalogue.
     *
     * Unmapped principals: the migration runner emits an ACE with
     * `type: "unknown"` and logs a per-record warning. The operator
     * inspects `_failed/` (when strategy="copy" and `error_on_unmapped`
     * is true) or the in-Mongo migration_shard_progress counter.
     */
    principal_map?: Record<string, PrincipalRef>;
    /**
     * Override the built-in source-permission → Vertesia-permission
     * rollup table. Each source key maps to a Vertesia permission
     * string ("content:read" / "content:write" / "content:admin" / "content:delete"
     * or a custom permission name). Entries missing from the map fall
     * back to the adapter's default rollup (documented per source in
     * docs/<source>-migration-mapping.md).
     */
    permission_map?: Record<string, string>;
    /**
     * Drop ACEs whose source ACL was inherited from a parent (Nuxeo
     * `name: "inherited"`, FileNet `Permission_Source: 2`, …). Vertesia
     * recomputes inherited permissions from the parent chain, so
     * re-emitting them duplicates ACE evaluation. Default: true.
     */
    drop_inherited?: boolean;
    /**
     * Drop deny ACEs (Nuxeo `grant: false`, FileNet AccessMask with
     * DENY bit). Most platforms preserve denies because they're
     * security-critical; set true only when the target type can't
     * model them. Default: false.
     */
    drop_deny?: boolean;
    /**
     * Drop ACEs with begin/end time bounds. Vertesia ACE doesn't model
     * TTL on grants — a time-bounded ACE migrated naively becomes
     * permanent. Default: true (drop with a warning per record).
     */
    drop_time_bounded?: boolean;
    /**
     * When strategy="copy" and a source principal isn't in
     * principal_map, fail the record instead of emitting an unmapped
     * ACE. Useful for compliance migrations where partial ACL fidelity
     * is unacceptable. Default: false.
     */
    error_on_unmapped?: boolean;
}

/**
 * Structured principal reference. Maps a source-system string id to a
 * Vertesia principal — disambiguates user/group/everyone since most
 * source systems store these as bare strings.
 */
export interface PrincipalRef {
    type: 'user' | 'group' | 'everyone' | 'anonymous' | 'unknown';
    /** Vertesia-side identifier. Omitted for `everyone` / `anonymous`. */
    id?: string;
    /** Optional display name for audit logs / UI surfacing. */
    display_name?: string;
}

export interface ContentMapping {
    /** "rewrite_uri" = pattern-substitute the source URI.
     *  "manifest" = look up new URI in a manifest file loaded at run start.
     *  "placeholder" = blank source URI; binary-copy step fills it later. */
    strategy: 'rewrite_uri' | 'manifest' | 'placeholder';
    uri_pattern?: string;
    uri_replace_to?: string;
    manifest_uri?: string;
}

export interface MigrationExecution {
    /** Which runtime executes this plan. Phase 1 default = "node". */
    runner: 'node' | 'go';
    sharded: boolean;
    shard_count: number;
    batch_size: number;
    read_concurrency: number;
    write_concurrency: number;
    /** If true, persist last_source_id per shard and resume on restart. */
    resumable: boolean;
    /** Source IDs to skip — used for re-runs after a partial failure where
     *  some IDs are known-bad. */
    skip_ids?: string[];
    /** Per-shard cap. 0/undefined = unlimited. Useful for dry-runs. */
    sample_size?: number;
    /** Run source + transform but skip the sink. Pairs with sample_size. */
    dry_run?: boolean;
    /** Initial sleep between ingester passes, in milliseconds. The
     *  workflow auto-tunes from here: shrinks when batches are flowing
     *  fast, grows when the bucket is empty. 0/undefined = default
     *  (10s). Clamped at runtime to [1s, 60s]. */
    ingest_interval_ms?: number;
}
