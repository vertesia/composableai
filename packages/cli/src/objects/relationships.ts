import { readFile } from 'node:fs/promises';
import type {
    CreateRelationshipPayload,
    FindRelationshipsPayload,
    TraverseRelationshipsPayload,
    UpdateRelationshipPayload,
    UpsertRelationshipsPayload,
} from '@vertesia/common';
import type { Command } from 'commander';
import { getClient } from '../client.js';

interface OutputOptions {
    json?: boolean;
    apply?: boolean;
}

function revision(value: string): number {
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 0) {
        throw new Error('Revision must be a non-negative integer.');
    }
    return parsed;
}

async function jsonInput<T>(value: string): Promise<T> {
    const source = value.startsWith('@') ? await readFile(value.slice(1), 'utf8') : value;
    try {
        const parsed: unknown = JSON.parse(source);
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('Expected a JSON object.');
        }
        return parsed as T;
    } catch (error: unknown) {
        throw new Error(`Invalid JSON input: ${error instanceof Error ? error.message : String(error)}`, {
            cause: error,
        });
    }
}

function show(result: unknown, options: OutputOptions, summary: string): void {
    console.log(options.json ? JSON.stringify(result, null, 2) : summary);
}

export function registerRelationshipCommands(content: Command): void {
    const relationships = content.command('relationships').description('Manage typed content relationships');

    relationships
        .command('create <input>')
        .description('Create a relationship from a JSON object or @file')
        .option('--json', 'Print the full response as JSON')
        .action(async (input: string, options: OutputOptions) => {
            const payload = await jsonInput<CreateRelationshipPayload>(input);
            const result = await (await getClient(content)).store.relationships.create(payload);
            show(result, options, `Created relationship ${result.id}`);
        });

    relationships
        .command('get <id>')
        .description('Retrieve a relationship')
        .option('--json', 'Print the full response as JSON')
        .action(async (id: string, options: OutputOptions) => {
            const result = await (await getClient(content)).store.relationships.retrieve(id);
            show(result, options, `${result.id}\t${result.type}`);
        });

    relationships
        .command('update <id> <input>')
        .description('Update a relationship from a JSON object or @file')
        .option('--json', 'Print the full response as JSON')
        .action(async (id: string, input: string, options: OutputOptions) => {
            const payload = await jsonInput<UpdateRelationshipPayload>(input);
            const result = await (await getClient(content)).store.relationships.update(id, payload);
            show(result, options, `Updated relationship ${result.id} at revision ${result.revision}`);
        });

    relationships
        .command('delete <id> <expected-revision>')
        .description('Soft-delete a relationship at the expected revision')
        .option('--json', 'Print the full response as JSON')
        .action(async (id: string, expectedRevision: string, options: OutputOptions) => {
            const result = await (await getClient(content)).store.relationships.remove(id, {
                expected_revision: revision(expectedRevision),
            });
            show(result, options, `Deleted relationship ${result.id}`);
        });

    relationships
        .command('upsert <input>')
        .description('Upsert a batch of relationships from a JSON object or @file')
        .option('--json', 'Print the full response as JSON')
        .action(async (input: string, options: OutputOptions) => {
            const payload = await jsonInput<UpsertRelationshipsPayload>(input);
            const result = await (await getClient(content)).store.relationships.upsert(payload);
            const succeeded = result.results.filter((item) => item.relationship).length;
            show(result, options, `${succeeded}/${result.results.length} relationship mutations succeeded`);
        });

    relationships
        .command('find <input>')
        .description('Find adjacent relationships using a JSON query or @file')
        .option('--json', 'Print the full response as JSON')
        .action(async (input: string, options: OutputOptions) => {
            const payload = await jsonInput<FindRelationshipsPayload>(input);
            const result = await (await getClient(content)).store.relationships.find(payload);
            show(result, options, `Found ${result.relationships.length} relationships`);
        });

    relationships
        .command('traverse <input>')
        .description('Traverse relationships using a JSON query or @file')
        .option('--json', 'Print the full response as JSON')
        .action(async (input: string, options: OutputOptions) => {
            const payload = await jsonInput<TraverseRelationshipsPayload>(input);
            const result = await (await getClient(content)).store.relationships.traverse(payload);
            show(result, options, `Found ${result.nodes.length} nodes and ${result.edges.length} relationships`);
        });

    relationships
        .command('reconcile <id>')
        .description('Preview declared field-map relationships for a source document; use --apply to write changes')
        .option('--apply', 'Apply the reconciliation instead of a dry run')
        .option('--json', 'Print the full response as JSON')
        .action(async (id: string, options: OutputOptions) => {
            const result = await (await getClient(content)).store.relationships.reconcile({
                document_id: id,
                dry_run: !options.apply,
            });
            show(
                result,
                options,
                `${result.dry_run ? 'Previewed' : 'Applied'} ${result.results.length} relationship maps`,
            );
        });

    relationships
        .command('value-hints <id>')
        .description('Show configured aggregate string-value hints for a document type')
        .option('--json', 'Print the full response as JSON')
        .action(async (id: string, options: OutputOptions) => {
            const result = await (await getClient(content)).store.relationships.valueHints({ document_id: id });
            show(result, options, `Found value hints for ${result.fields.length} fields`);
        });
}
