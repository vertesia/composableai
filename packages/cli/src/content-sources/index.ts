import type {
    ContentSourcePermissionSettings,
    ContentSourceReportAction,
    ContentSourceReportEntry,
    ContentSourceStatus,
    ContentSourceSyncRound,
    ContentSourceSyncSettings,
    CreateContentSourcePayload,
    ExternalContentSource,
    UpdateContentSourcePayload,
} from '@vertesia/common';
import type { Command } from 'commander';
import { getClient } from '../client.js';

const SOURCE_TYPES = ['sharepoint', 'box'] as const;
type SourceType = (typeof SOURCE_TYPES)[number];
const REPORT_ACTIONS: readonly ContentSourceReportAction[] = ['created', 'updated', 'deleted', 'skipped', 'failed'];
/** The largest page the report endpoint returns. */
const REPORT_PAGE_SIZE = 1000;

interface PermissionOptions {
    permissionMode?: string;
    permissionReader?: string;
    entraTenant?: string;
    scimConnection?: string;
    tenantGroup?: string;
    permissionRefresh?: string;
    permissionMaxStale?: string;
}

interface CreateOptions extends PermissionOptions {
    type: string;
    name: string;
    oauthProvider: string;
    siteUrl?: string;
    library?: string;
    folder?: string;
    folderId?: string;
    locationRoot?: string;
    collection?: string;
    description?: string;
    interval?: string;
    schedule?: boolean;
    json?: boolean;
}

interface UpdateOptions extends PermissionOptions {
    name?: string;
    description?: string;
    interval?: string;
    schedule?: boolean;
    json?: boolean;
}

function print(value: unknown) {
    console.log(JSON.stringify(value, null, 2));
}

function describeFolder(source: ExternalContentSource): string {
    if (source.type === 'sharepoint') {
        const folder = source.folder_path ? `/${source.folder_path}` : '';
        return `${source.site_url} → ${source.library_name}${folder}`;
    }
    return `Box folder ${source.folder_id} (${source.folder_path || source.folder_name})`;
}

function describeSource(source: ExternalContentSource): string {
    const schedule = source.sync.enabled ? `every ${source.sync.interval_minutes} min` : 'manual';
    return `${source.id}  ${source.name}  [${source.type}]  ${describeFolder(source)}  (${source.location_root}, ${schedule})`;
}

function describeRound(label: string, round: ContentSourceSyncRound): string {
    const { counts } = round;
    const end = round.finished_at ? ` → ${round.finished_at}` : '';
    const parts = [
        `listed ${counts.listed}`,
        `created ${counts.created}`,
        `updated ${counts.updated}`,
        `unchanged ${counts.unchanged}`,
        `deleted ${counts.deleted}`,
        `skipped ${counts.skipped}`,
        `failed ${counts.failed}`,
    ];
    const swept = round.swept === undefined ? '' : round.swept ? ', swept' : ', not swept';
    const reasons = Object.entries(round.skipped_by_reason ?? {})
        .map(([reason, count]) => `${reason} ${count}`)
        .join(', ');
    const skipped = reasons ? `\n    skipped: ${reasons}` : '';
    const error = round.error ? `\n    error: ${round.error}` : '';
    const id = round.id ? ` (round ${round.id})` : '';
    return `${label}: ${round.kind} ${round.started_at}${end}${id}\n    ${parts.join(', ')}${swept}${skipped}${error}`;
}

function describeEntry(entry: ContentSourceReportEntry): string {
    const where =
        entry.kind === 'folder'
            ? `folder ${entry.path || '/'}`
            : entry.path
              ? `${entry.path}/${entry.name}`
              : entry.name;
    const details = [
        entry.changes?.length ? `changed: ${entry.changes.join(', ')}` : '',
        entry.reason ? `reason: ${entry.reason}` : '',
        entry.error ? `error: ${entry.error}` : '',
        entry.object_id ? `document ${entry.object_id}` : '',
    ].filter(Boolean);
    return `${entry.action.padEnd(7)}  ${where}${details.length ? `  (${details.join('; ')})` : ''}`;
}

function parseAction(value: string | undefined): ContentSourceReportAction | undefined {
    if (value === undefined) {
        return undefined;
    }
    const action = REPORT_ACTIONS.find((candidate) => candidate === value);
    if (!action) {
        throw new Error(`Invalid action "${value}": expected ${REPORT_ACTIONS.join(', ')}`);
    }
    return action;
}

function parseLimit(value: string | undefined): number | undefined {
    if (value === undefined) {
        return undefined;
    }
    const limit = Number(value);
    if (!Number.isInteger(limit) || limit < 1) {
        throw new Error('Invalid limit: expected a positive whole number');
    }
    return limit;
}

function describeStatus(status: ContentSourceStatus): string {
    const lines = [`state: ${status.state}`];
    if (status.permissions) {
        const { state, refreshed_at, unresolved } = status.permissions;
        lines.push(
            `Permissions ${state} · ${unresolved} unresolved${refreshed_at ? ` · verified ${refreshed_at}` : ''}`,
        );
    }
    if (status.error) {
        lines.push(`error: ${status.error}`);
    }
    if (status.current_round) {
        lines.push(describeRound('current', status.current_round));
    }
    if (status.last_round) {
        lines.push(describeRound('last', status.last_round));
    }
    const earlier = (status.recent_rounds ?? []).filter((round) => round.id !== status.last_round?.id);
    if (earlier.length > 0) {
        lines.push('earlier rounds:');
        for (const round of earlier) {
            lines.push(
                `    ${round.id}  ${round.kind} ${round.started_at}  created ${round.counts.created}, ` +
                    `updated ${round.counts.updated}, deleted ${round.counts.deleted}, ` +
                    `skipped ${round.counts.skipped}, failed ${round.counts.failed}`,
            );
        }
    }
    if (status.cursor_taken_at) {
        lines.push(`changes read since: ${status.cursor_taken_at}`);
    }
    if (status.next_sync_at) {
        lines.push(`next sync: ${status.next_sync_at}`);
    }
    if (status.notifications) {
        const { state, last_notification_at, error } = status.notifications;
        lines.push(
            `change notifications: ${state}` +
                (last_notification_at ? ` · last ${last_notification_at}` : '') +
                (error ? ` · ${error}` : ''),
        );
    }
    return lines.join('\n');
}

function parseInterval(value: string | undefined): number | undefined {
    if (value === undefined) {
        return undefined;
    }
    const minutes = Number(value);
    if (!Number.isInteger(minutes) || minutes < 1) {
        throw new Error('Invalid interval: expected a whole number of minutes');
    }
    return minutes;
}

function parseType(value: string): SourceType {
    const type = SOURCE_TYPES.find((candidate) => candidate === value);
    if (!type) {
        throw new Error(`Invalid type "${value}": expected ${SOURCE_TYPES.join(' or ')}`);
    }
    return type;
}

/** The sync settings an option set asks for, or undefined when it names none. */
function syncSettings(
    options: { interval?: string; schedule?: boolean },
    current?: ContentSourceSyncSettings,
): ContentSourceSyncSettings | undefined {
    const interval = parseInterval(options.interval);
    if (interval === undefined && options.schedule === undefined) {
        return undefined;
    }
    return {
        enabled: options.schedule ?? current?.enabled ?? interval !== undefined,
        interval_minutes: interval ?? current?.interval_minutes ?? 60,
    };
}

function permissionSettings(options: PermissionOptions): ContentSourcePermissionSettings | undefined {
    if (options.permissionMode === 'project') return { mode: 'project' };
    const { permissionReader, entraTenant, scimConnection, tenantGroup, permissionRefresh, permissionMaxStale } =
        options;
    const supplied = [
        permissionReader,
        entraTenant,
        scimConnection,
        tenantGroup,
        permissionRefresh,
        permissionMaxStale,
    ];
    if (!options.permissionMode && supplied.every((value) => value === undefined)) return undefined;
    if (options.permissionMode !== 'source' || !permissionReader || !entraTenant || !scimConnection) {
        throw new Error(
            'Source permissions require --permission-mode source, --permission-reader, --entra-tenant and --scim-connection',
        );
    }
    const integer = (value: string | undefined, min: number, max: number) => {
        if (value === undefined) return undefined;
        const number = Number(value);
        if (!Number.isInteger(number) || number < min || number > max)
            throw new Error(`Expected an integer from ${min} to ${max}`);
        return number;
    };
    return {
        mode: 'source',
        entra_tenant_id: entraTenant,
        scim_connection_id: scimConnection,
        permission_reader_provider_id: permissionReader,
        tenant_group_id: tenantGroup,
        refresh_minutes: integer(permissionRefresh, 15, 1440),
        max_stale_hours: integer(permissionMaxStale, 1, 168),
    };
}

function permissionOptions(command: Command): Command {
    return command
        .option('--permission-mode <mode>', 'Read access from the source or the project')
        .option('--permission-reader <id>', 'Site-bound SharePoint certificate OAuth provider ID')
        .option('--entra-tenant <id>', 'Microsoft Entra tenant ID')
        .option('--scim-connection <id>', 'Designated SCIM provisioning API key ID')
        .option('--tenant-group <id>', 'Verified tenant-member Vertesia group ID')
        .option('--permission-refresh <minutes>', 'Minutes between permission refreshes')
        .option('--permission-max-stale <hours>', 'Hours before an unverified policy stops granting access');
}

function createPayload(options: CreateOptions): CreateContentSourcePayload {
    const type = parseType(options.type);
    const sync = syncSettings(options);
    const permissions = permissionSettings(options);
    const common = {
        name: options.name,
        oauth_provider_id: options.oauthProvider,
        ...(options.description ? { description: options.description } : {}),
        ...(options.locationRoot ? { location_root: options.locationRoot } : {}),
        ...(options.collection ? { collection_id: options.collection } : {}),
        ...(sync ? { sync } : {}),
    };
    if (type === 'sharepoint') {
        if (!options.siteUrl) {
            throw new Error('--site-url is required for a SharePoint source');
        }
        return {
            ...common,
            type,
            site_url: options.siteUrl,
            ...(permissions ? { permissions } : {}),
            ...(options.library ? { library_name: options.library } : {}),
            ...(options.folder ? { folder_path: options.folder } : {}),
        };
    }
    if (permissions) throw new Error('Permission settings require a SharePoint source');
    if (!options.folderId) {
        throw new Error('--folder-id is required for a Box source');
    }
    return { ...common, type, folder_id: options.folderId };
}

export function registerContentSourcesCommand(program: Command) {
    const command = program
        .command('content-sources')
        .description('Sync folders of SharePoint or Box into the project without copying their files.');

    command
        .command('list')
        .description('List the content sources of the project.')
        .option('--json', 'Print the full sources as JSON')
        .action(async (options: { json?: boolean }) => {
            const sources = await (await getClient(program)).contentSources.list();
            if (options.json) {
                print(sources);
                return;
            }
            for (const source of sources) {
                console.log(describeSource(source));
            }
        });

    command
        .command('get <id>')
        .description('Show a content source.')
        .action(async (id: string) => print(await (await getClient(program)).contentSources.retrieve(id)));

    permissionOptions(
        command
            .command('create')
            .description('Register a folder after checking it with the system, then start its first sync.')
            .requiredOption('--type <type>', 'sharepoint or box')
            .requiredOption('--name <name>', 'Unique name in the project')
            .requiredOption(
                '--oauth-provider <id>',
                'OAuth provider of the project (grant type client_credentials) that issues the tokens of the system',
            )
            .option('--site-url <url>', 'SharePoint: site URL, e.g. https://contoso.sharepoint.com/sites/legal')
            .option('--library <name>', "SharePoint: document library name (defaults to the site's default library)")
            .option('--folder <path>', 'SharePoint: folder inside the library, e.g. Contracts/2026')
            .option('--folder-id <id>', "Box: folder ID, shared with the Box app's service account")
            .option('--location-root <location>', 'Location root for synced documents (defaults to /<type>/<name>)')
            .option('--collection <id>', 'Collection to add synced documents to')
            .option('--description <text>', 'Description')
            .option('--interval <minutes>', 'Minutes between scheduled syncs (enables the schedule)')
            .option('--schedule', 'Enable the schedule, every 60 minutes unless --interval is given')
            .option('--json', 'Print the created source as JSON'),
    ).action(async (options: CreateOptions) => {
        const source = await (await getClient(program)).contentSources.create(createPayload(options));
        if (options.json) {
            print(source);
        } else {
            console.log(`Created ${describeSource(source)}`);
        }
    });

    permissionOptions(
        command
            .command('update <id>')
            .description(
                'Change the name, description or schedule. Also restarts a sync whose credentials were refused.',
            )
            .option('--name <name>', 'New name')
            .option('--description <text>', 'New description')
            .option('--interval <minutes>', 'Minutes between scheduled syncs')
            .option('--schedule', 'Enable the schedule')
            .option('--no-schedule', 'Disable the schedule: sync only on request')
            .option('--json', 'Print the updated source as JSON'),
    ).action(async (id: string, options: UpdateOptions) => {
        const client = await getClient(program);
        const wantsSync = options.interval !== undefined || options.schedule !== undefined;
        const current = wantsSync ? (await client.contentSources.retrieve(id)).sync : undefined;
        const sync = syncSettings(options, current);
        const permissions = permissionSettings(options);
        const payload: UpdateContentSourcePayload = {
            ...(options.name ? { name: options.name } : {}),
            ...(options.description !== undefined ? { description: options.description } : {}),
            ...(sync ? { sync } : {}),
            ...(permissions ? { permissions } : {}),
        };
        const source = await client.contentSources.update(id, payload);
        if (options.json) {
            print(source);
        } else {
            console.log(`Updated ${describeSource(source)}`);
        }
    });

    command
        .command('delete <id>')
        .description('Stop the sync and remove the source. Synced documents are kept.')
        .action(async (id: string) => print(await (await getClient(program)).contentSources.delete(id)));

    command
        .command('sync <id>')
        .description('Sync now: read the changes, or with --full, list the whole folder and remove deleted files.')
        .option('--full', 'List the whole folder again')
        .option('--json', 'Print the status as JSON')
        .action(async (id: string, options: { full?: boolean; json?: boolean }) => {
            const status = await (await getClient(program)).contentSources.sync(id, {
                ...(options.full ? { full: true } : {}),
            });
            console.log(options.json ? JSON.stringify(status, null, 2) : describeStatus(status));
        });

    command
        .command('status <id>')
        .description("Show the sync's state, its current and last rounds, and the next scheduled sync.")
        .option('--json', 'Print the status as JSON')
        .action(async (id: string, options: { json?: boolean }) => {
            const status = await (await getClient(program)).contentSources.status(id);
            console.log(options.json ? JSON.stringify(status, null, 2) : describeStatus(status));
        });

    command
        .command('report <id> [round]')
        .description(
            'List what a sync round did with each file: created, updated, deleted, skipped or failed. ' +
                'Defaults to the current round, or the last one; round IDs are in the status.',
        )
        .option('--action <action>', `Only one action: ${REPORT_ACTIONS.join(', ')}`)
        .option('--limit <count>', 'Stop after this many entries')
        .option('--json', 'Print the entries as JSON')
        .action(
            async (
                id: string,
                round: string | undefined,
                options: { action?: string; limit?: string; json?: boolean },
            ) => {
                const action = parseAction(options.action);
                const limit = parseLimit(options.limit);
                const client = await getClient(program);
                let roundId = round;
                if (!roundId) {
                    const status = await client.contentSources.status(id);
                    roundId = status.current_round?.id ?? status.last_round?.id;
                    if (!roundId) {
                        throw new Error('This source has no round with a report yet');
                    }
                }
                const entries: ContentSourceReportEntry[] = [];
                let cursor: string | undefined;
                do {
                    const remaining = limit === undefined ? REPORT_PAGE_SIZE : limit - entries.length;
                    const page = await client.contentSources.report(id, roundId, {
                        ...(action ? { action } : {}),
                        ...(cursor ? { cursor } : {}),
                        limit: Math.min(REPORT_PAGE_SIZE, remaining),
                    });
                    entries.push(...page.entries);
                    cursor = page.next_cursor;
                } while (cursor && (limit === undefined || entries.length < limit));

                if (options.json) {
                    print({ round_id: roundId, entries, ...(cursor ? { truncated: true } : {}) });
                    return;
                }
                console.log(`round ${roundId}: ${entries.length} entries${cursor ? ' (more not shown)' : ''}`);
                for (const entry of entries) {
                    console.log(describeEntry(entry));
                }
            },
        );
}
