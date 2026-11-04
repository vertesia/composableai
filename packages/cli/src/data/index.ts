import type { Command } from 'commander';
import { importData, listDataStores } from './commands.js';
import { collectParam, exportDashboard, exportDashboardPreview, listDashboards } from './dashboards.js';

export function registerDataCommand(program: Command) {
    const data = program.command('data').description('Manage analytical data stores and imports');

    data.command('list')
        .description('List data stores in the current project')
        .option('--json', 'Output full JSON instead of tab-separated text')
        .action(async (options: Record<string, unknown>) => {
            await listDataStores(program, options);
        });

    data.command('import <storeId> <tableName> [input]')
        .description(
            'Import local files, stdin, or remote URIs (gs://, s3://, az://, https://) into a data store table',
        )
        .option('--mode [mode]', 'Import mode: append or replace', 'append')
        .option('--format [format]', 'Input format: csv, json, or parquet. Inferred from filename when omitted.')
        .option('--message [message]', 'Version history message for the import')
        .option('--name [name]', 'Uploaded filename to use when reading from stdin or overriding a local filename')
        .option('--mime [mimeType]', 'MIME type for uploads from local files or stdin')
        .option('--prefix [pathPrefix]', 'Custom staging prefix in project storage for uploaded local files')
        .option('--json', 'Output full JSON instead of a short summary')
        .action(
            async (storeId: string, tableName: string, input: string | undefined, options: Record<string, unknown>) => {
                await importData(program, storeId, tableName, input, options);
            },
        );

    const dashboards = data.command('dashboards').description('List data store dashboards and export them as images');

    dashboards
        .command('list <storeId>')
        .description('List the dashboards of a data store')
        .option('--status [status]', 'Only list active or archived dashboards')
        .option('--json', 'Output full JSON instead of tab-separated text')
        .action(async (storeId: string, options: Record<string, unknown>) => {
            await listDashboards(program, storeId, options);
        });

    dashboards
        .command('export <storeId> <dashboardId>')
        .description('Render a saved dashboard to PNG and save the image')
        .option('-o, --output [file]', 'Image file to write (default: <dashboardId>.png)')
        .option('--param <key=value>', 'Dashboard parameter value; repeat for several', collectParam)
        .option('--scale [scale]', 'Device pixel ratio, greater than 0 and at most 4')
        .option('--background [color]', 'CSS background color for the image')
        .option('--timeout [seconds]', 'How long to wait for the export to finish (default: 300)')
        .option('--json', 'Print the export as JSON instead of downloading the image')
        .action(async (storeId: string, dashboardId: string, options: Record<string, unknown>) => {
            await exportDashboard(program, storeId, dashboardId, options);
        });

    dashboards
        .command('export-preview <storeId>')
        .description('Render an unsaved SQL query and Vega-Lite spec to PNG and save the image')
        .requiredOption('--query <sql>', 'SQL query, or @file to read it from a file')
        .requiredOption('--spec <json>', 'Vega-Lite spec as JSON, or @file to read it from a file')
        .option('--query-limit [rows]', 'Maximum number of rows the query returns')
        .option('-o, --output [file]', 'Image file to write (default: dashboard-preview.png)')
        .option('--param <key=value>', 'Query parameter value; repeat for several', collectParam)
        .option('--scale [scale]', 'Device pixel ratio, greater than 0 and at most 4')
        .option('--background [color]', 'CSS background color for the image')
        .option('--timeout [seconds]', 'How long to wait for the export to finish (default: 300)')
        .option('--json', 'Print the export as JSON instead of downloading the image')
        .action(async (storeId: string, options: Record<string, unknown>) => {
            await exportDashboardPreview(program, storeId, options);
        });
}
