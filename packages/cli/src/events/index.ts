import type { Command } from 'commander';
import {
    applyEventSubscription,
    createEventSubscription,
    deleteEventSubscription,
    getEventSubscription,
    listEventSubscriptions,
    updateEventSubscription,
} from './commands.js';

export function registerEventsCommand(program: Command) {
    const events = program.command('events').description('Manage platform events');
    const subscriptions = events.command('subscriptions').description('Manage event subscriptions');

    subscriptions
        .command('list')
        .description('List event subscriptions visible to the current project')
        .action(async (options: Record<string, unknown>) => {
            await listEventSubscriptions(program, options);
        });

    subscriptions
        .command('get <subscriptionId>')
        .description('Get an event subscription by ID')
        .option('-f, --file [file]', 'The file to save the event subscription to.')
        .action(async (subscriptionId: string, options: Record<string, unknown>) => {
            await getEventSubscription(program, subscriptionId, options);
        });

    subscriptions
        .command('create')
        .description('Create an event subscription from a JSON file')
        .option('-f, --file <file>', 'The file containing the event subscription payload.')
        .action(async (options: Record<string, unknown>) => {
            await createEventSubscription(program, options);
        });

    subscriptions
        .command('update <subscriptionId>')
        .description('Update an event subscription from a JSON file')
        .option('-f, --file <file>', 'The file containing the event subscription update payload.')
        .action(async (subscriptionId: string, options: Record<string, unknown>) => {
            await updateEventSubscription(program, subscriptionId, options);
        });

    subscriptions
        .command('apply [subscriptionId]')
        .description('Create or update an event subscription from a JSON file')
        .option('-f, --file <file>', 'The file containing the event subscription payload.')
        .action(async (subscriptionId: string | undefined, options: Record<string, unknown>) => {
            await applyEventSubscription(program, subscriptionId, options);
        });

    subscriptions
        .command('delete <subscriptionId>')
        .description('Delete an event subscription by ID')
        .action(async (subscriptionId: string, options: Record<string, unknown>) => {
            await deleteEventSubscription(program, subscriptionId, options);
        });
}
