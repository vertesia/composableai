/**
 * Source-system identifiers used in MigrationPlan.source.kind.
 *
 * Stable strings — used as keys in the runner's adapter registry and as
 * filter values on `migration_runs` documents. Don't rename without a
 * migration; the migration_runs collection holds historical values.
 *
 * Phase 1 (Node runner) supports the api-based kinds. Phase 2 (Go runner)
 * adds the direct-DB kinds.
 */

export const SOURCE_KINDS = [
    // CMIS browser-binding adapters — covers any CMIS 1.1 endpoint.
    // The single Node `cmis` adapter handles all of these; the `kind` value
    // is preserved for vendor detection + reporting only.
    'cmis_documentum',
    'cmis_filenet',
    'cmis_alfresco',
    'cmis_nuxeo',
    'cmis_opentext_cs',
    'cmis_ser_doxis',
    'cmis_hyland_onbase',
    'cmis_generic',

    // First-party SaaS APIs — Node adapters.
    'sharepoint_graph',
    'sharepoint_migration_api',
    'gdrive',
    'hyland_hxp',

    // Direct-DB sources — Go runner (Phase 2).
    'nuxeo_mongo',
    'nuxeo_postgres',
    'alfresco_postgres',
    'filenet_db2',
    'filenet_ce_api',
    'documentum',
    'opentext',
    'opentext_livelink',
] as const;

export type SourceKind = (typeof SOURCE_KINDS)[number];

export function isSourceKind(value: string): value is SourceKind {
    return (SOURCE_KINDS as readonly string[]).includes(value);
}

/**
 * Which runtime executes a plan with this source kind.
 *
 * The planner picks `execution.runner` based on this map plus the
 * `count` estimate — a Node-eligible kind still gets routed to Go if
 * the volume is above the Node ceiling.
 */
export const SOURCE_KIND_RUNNER: Record<SourceKind, 'node' | 'go'> = {
    cmis_documentum: 'node',
    cmis_filenet: 'node',
    cmis_alfresco: 'node',
    cmis_nuxeo: 'node',
    cmis_opentext_cs: 'node',
    cmis_ser_doxis: 'node',
    cmis_hyland_onbase: 'node',
    cmis_generic: 'node',
    sharepoint_graph: 'node',
    sharepoint_migration_api: 'node',
    gdrive: 'node',
    hyland_hxp: 'node',
    nuxeo_mongo: 'go',
    nuxeo_postgres: 'go',
    alfresco_postgres: 'go',
    filenet_db2: 'go',
    filenet_ce_api: 'node',
    documentum: 'go',
    opentext: 'go',
    opentext_livelink: 'go',
};
