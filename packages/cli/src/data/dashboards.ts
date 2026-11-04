import { readFile, writeFile } from 'node:fs/promises';
import {
    type DashboardExport,
    DashboardExportStatus,
    type DashboardItem,
    type DashboardStatus,
    type ExportDashboardPayload,
} from '@vertesia/common';
import type { Command } from 'commander';
import { getClient } from '../client.js';
import { type CliOptions, getStringOption, isRecord } from '../utils/options.js';

const DASHBOARD_STATUSES = new Set<DashboardStatus>(['active', 'archived']);
const DEFAULT_EXPORT_TIMEOUT_SECONDS = 300;

type ListDashboardsOptions = CliOptions<{ json?: boolean; status?: string }>;

type RenderOptions = CliOptions<{
    param?: string[];
    scale?: string;
    background?: string;
    timeout?: string;
    output?: string;
    json?: boolean;
}>;

type ExportPreviewOptions = RenderOptions & CliOptions<{ query?: string; spec?: string; queryLimit?: string }>;

export async function listDashboards(program: Command, storeId: string, options: ListDashboardsOptions) {
    const client = await getClient(program);
    const dashboards = await client.data.dashboards(storeId).list(parseStatus(options.status));

    if (options.json) {
        console.log(JSON.stringify(dashboards, null, 2));
        return;
    }

    console.log('id\tname\tstatus\tlast_rendered_at\tupdated_at');
    dashboards.forEach((dashboard: DashboardItem) => {
        console.log(
            [
                dashboard.id,
                dashboard.name,
                dashboard.status,
                dashboard.last_rendered_at ?? '',
                dashboard.updated_at,
            ].join('\t'),
        );
    });
}

/** Renders a saved dashboard to PNG, waits for it, and saves the image. */
export async function exportDashboard(program: Command, storeId: string, dashboardId: string, options: RenderOptions) {
    const payload = renderPayload(options);
    const wait = { timeoutMs: timeoutMs(options.timeout) };
    const client = await getClient(program);
    const dashboards = client.data.dashboards(storeId);
    const started = await dashboards.export(dashboardId, payload);
    const result = await dashboards.waitForExport(started.export_id, wait);
    await reportExport(result, options, `${dashboardId}.png`);
}

/** Renders an unsaved SQL query and Vega-Lite spec to PNG without saving a dashboard. */
export async function exportDashboardPreview(program: Command, storeId: string, options: ExportPreviewOptions) {
    const query = await readInlineOrFile(options.query, '--query');
    const spec = parseSpec(await readInlineOrFile(options.spec, '--spec'));
    const { parameter_values, ...renderOptions } = renderPayload(options);
    const queryLimit = parseQueryLimit(options.queryLimit);
    const wait = { timeoutMs: timeoutMs(options.timeout) };
    const client = await getClient(program);
    const dashboards = client.data.dashboards(storeId);
    const started = await dashboards.exportPreview({
        query,
        spec,
        queryLimit,
        queryParameters: parameter_values,
        ...renderOptions,
    });
    const result = await dashboards.waitForExport(started.export_id, wait);
    await reportExport(result, options, 'dashboard-preview.png');
}

/** Collects a repeatable `--param key=value` option. */
export function collectParam(value: string, previous: string[] = []): string[] {
    return [...previous, value];
}

export function parseParams(params: string[] | undefined): Record<string, string> | undefined {
    if (!params || params.length === 0) {
        return undefined;
    }
    const values: Record<string, string> = {};
    for (const param of params) {
        const separator = param.indexOf('=');
        const key = separator > 0 ? param.slice(0, separator).trim() : '';
        if (!key) {
            throw new Error(`Invalid --param '${param}'. Expected key=value.`);
        }
        values[key] = param.slice(separator + 1);
    }
    return values;
}

function renderPayload(options: RenderOptions): ExportDashboardPayload {
    return {
        parameter_values: parseParams(options.param),
        scale: parseScale(options.scale),
        background_color: getStringOption(options.background),
    };
}

function parseStatus(value: string | undefined): DashboardStatus | undefined {
    const status = getStringOption(value);
    if (status === undefined) {
        return undefined;
    }
    if (!DASHBOARD_STATUSES.has(status as DashboardStatus)) {
        throw new Error(`Invalid --status '${status}'. Expected active or archived.`);
    }
    return status as DashboardStatus;
}

function parseScale(value: string | undefined): number | undefined {
    if (value === undefined) {
        return undefined;
    }
    const scale = Number(value);
    if (!Number.isFinite(scale) || scale <= 0 || scale > 4) {
        throw new Error(`Invalid --scale '${value}'. Expected a number greater than 0 and at most 4.`);
    }
    return scale;
}

function parseQueryLimit(value: string | undefined): number | undefined {
    if (value === undefined) {
        return undefined;
    }
    const limit = Number(value);
    if (!Number.isInteger(limit) || limit <= 0) {
        throw new Error(`Invalid --query-limit '${value}'. Expected a positive integer.`);
    }
    return limit;
}

function timeoutMs(value: string | undefined): number {
    if (value === undefined) {
        return DEFAULT_EXPORT_TIMEOUT_SECONDS * 1000;
    }
    const seconds = Number(value);
    if (!Number.isFinite(seconds) || seconds <= 0) {
        throw new Error(`Invalid --timeout '${value}'. Expected a number of seconds greater than 0.`);
    }
    return seconds * 1000;
}

/** Reads an option given inline or, prefixed with `@`, from a file. */
async function readInlineOrFile(value: string | undefined, name: string): Promise<string> {
    if (value === undefined || value.trim() === '') {
        throw new Error(`${name} is required.`);
    }
    return value.startsWith('@') ? readFile(value.slice(1), 'utf8') : value;
}

function parseSpec(text: string): Record<string, unknown> {
    let spec: unknown;
    try {
        spec = JSON.parse(text);
    } catch (error: unknown) {
        throw new Error(`--spec is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!isRecord(spec)) {
        throw new Error('--spec must be a JSON object (a Vega-Lite specification).');
    }
    return spec;
}

/**
 * Prints a failed export's error and exits non-zero, or saves a completed export's image. With `--json`
 * it prints the export instead of downloading it.
 */
async function reportExport(result: DashboardExport, options: RenderOptions, defaultOutput: string) {
    if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        if (result.status !== DashboardExportStatus.COMPLETED) {
            process.exitCode = 1;
        }
        return;
    }

    if (result.status !== DashboardExportStatus.COMPLETED || !result.url) {
        const reason = result.error ? `${result.error.code}: ${result.error.message}` : `status ${result.status}`;
        const retry = result.error?.retryable ? ' (retryable)' : '';
        throw new Error(`Dashboard export ${result.export_id} failed${retry}. ${reason}`);
    }

    const response = await fetch(result.url);
    if (!response.ok) {
        throw new Error(`Downloading the dashboard image failed with HTTP ${response.status}`);
    }
    const output = getStringOption(options.output) ?? defaultOutput;
    await writeFile(output, Buffer.from(await response.arrayBuffer()));
    const size = result.width && result.height ? ` (${result.width}x${result.height})` : '';
    console.log(`Saved ${output}${size}`);
}
