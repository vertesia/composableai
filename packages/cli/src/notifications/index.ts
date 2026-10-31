import type { ListNotificationsQuery, NotificationCategory, NotificationPreferences } from '@vertesia/common';
import type { Command } from 'commander';
import { getClient } from '../client.js';

const CATEGORIES: NotificationCategory[] = ['actions', 'failures', 'results'];

function print(value: unknown) {
    console.log(JSON.stringify(value, null, 2));
}

function ids(values: string[]): string[] {
    const list = values.flatMap((value) => value.split(',')).filter((value) => value.length > 0);
    if (list.length === 0) throw new Error('Expected at least one notification id');
    return list;
}

function preferencesInput(input: string): NotificationPreferences {
    const parsed: unknown = JSON.parse(input);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Expected a JSON object');
    const value = parsed as Partial<NotificationPreferences>;
    return { categories: value.categories ?? {}, kinds: value.kinds ?? {} };
}

export function registerNotificationsCommand(program: Command) {
    const command = program
        .command('notifications')
        .description('Read and manage your notification inbox in the current project. All output is JSON.');

    command
        .command('list')
        .description('List your notifications, newest first')
        .option('--unread', 'Only notifications that were not read')
        .option('--archived', 'Archived notifications instead of the inbox')
        .option('--category <category>', `One of ${CATEGORIES.join(', ')}`)
        .option('--limit <number>', 'Page size (1–100)')
        .option('--cursor <cursor>', 'The next_cursor of the previous page')
        .action(
            async (options: {
                unread?: boolean;
                archived?: boolean;
                category?: string;
                limit?: string;
                cursor?: string;
            }) => {
                const query: ListNotificationsQuery = {};
                if (options.unread) query.unread = true;
                if (options.archived) query.archived = true;
                if (options.category) {
                    if (!CATEGORIES.includes(options.category as NotificationCategory))
                        throw new Error(`Invalid category: ${options.category}`);
                    query.category = options.category as NotificationCategory;
                }
                if (options.limit !== undefined) {
                    const limit = Number(options.limit);
                    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Invalid limit');
                    query.limit = limit;
                }
                if (options.cursor) query.cursor = options.cursor;
                print(await (await getClient(program)).store.notifications.list(query));
            },
        );
    command
        .command('get <id>')
        .action(async (id: string) => print(await (await getClient(program)).store.notifications.retrieve(id)));
    command
        .command('counts')
        .description('Show the unseen and needs-action counts')
        .action(async () => print(await (await getClient(program)).store.notifications.counts()));
    command
        .command('read <ids...>')
        .description('Mark notifications read')
        .action(async (values: string[]) =>
            print(await (await getClient(program)).store.notifications.markRead({ ids: ids(values) })),
        );
    command
        .command('read-all')
        .description('Mark read every notification written until now')
        .action(async () => {
            const client = await getClient(program);
            const page = await client.store.notifications.list({ limit: 1 });
            print(await client.store.notifications.markAllRead({ before: page.read_all_before }));
        });
    command
        .command('archive <ids...>')
        .description('Archive notifications')
        .action(async (values: string[]) =>
            print(await (await getClient(program)).store.notifications.archive({ ids: ids(values) })),
        );

    const preferences = command.command('preferences').description('Read or replace your notification preferences');
    preferences
        .command('get')
        .action(async () => print(await (await getClient(program)).store.notifications.getPreferences()));
    preferences
        .command('set <json>')
        .description('Replace preferences, e.g. {"categories":{"results":{"in_app":false}},"kinds":{}}')
        .action(async (json: string) =>
            print(await (await getClient(program)).store.notifications.updatePreferences(preferencesInput(json))),
        );

    return command;
}
