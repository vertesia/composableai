import type {
    CreateEventSubscriptionPayload,
    EventSubscription,
    UpdateEventSubscriptionPayload,
} from '@vertesia/common';
import type { Command } from 'commander';
import { getClient } from '../client.js';
import { type CliOptions, getStringOption, isRecord } from '../utils/options.js';
import { readJsonFile, writeFile } from '../utils/stdio.js';

type EventSubscriptionFileOptions = CliOptions<{
    file?: string;
}>;

function printJson(value: unknown) {
    console.log(JSON.stringify(value, null, 2));
}

function writeOrPrint(value: unknown, file?: string) {
    const content = JSON.stringify(value, null, 2);
    if (file) {
        writeFile(file, `${content}\n`);
        console.log('Event subscription saved to', file);
        return;
    }
    console.log(content);
}

function requireFile(options: EventSubscriptionFileOptions): string {
    const file = getStringOption(options.file);
    if (!file) {
        console.error('A JSON file is required. Use --file argument.');
        process.exit(1);
    }
    return file;
}

function readPayload(file: string): Record<string, unknown> {
    const value = readJsonFile(file);
    if (!isRecord(value)) {
        console.error('Expected event subscription JSON to be an object.');
        process.exit(1);
    }
    return value;
}

function toCreatePayload(value: Record<string, unknown>): CreateEventSubscriptionPayload {
    const payload: CreateEventSubscriptionPayload = {
        name: value.name as string,
        ...(typeof value.description === 'string' ? { description: value.description } : {}),
        ...(value.scope === 'account' || value.scope === 'project' ? { scope: value.scope } : {}),
        filter: value.filter as CreateEventSubscriptionPayload['filter'],
        target: value.target as CreateEventSubscriptionPayload['target'],
        run_as_role: value.run_as_role as CreateEventSubscriptionPayload['run_as_role'],
        ...(typeof value.enabled === 'boolean' ? { enabled: value.enabled } : {}),
        ...(value.priority === 'high' || value.priority === 'normal' || value.priority === 'low'
            ? { priority: value.priority }
            : {}),
    };

    if (!payload.name || !payload.filter || !payload.target || !payload.run_as_role) {
        console.error('Event subscription JSON must include name, filter, target, and run_as_role.');
        process.exit(1);
    }

    return payload;
}

function toUpdatePayload(value: Record<string, unknown>): UpdateEventSubscriptionPayload {
    return {
        ...(typeof value.name === 'string' ? { name: value.name } : {}),
        ...(typeof value.description === 'string' ? { description: value.description } : {}),
        ...(value.filter !== undefined ? { filter: value.filter as UpdateEventSubscriptionPayload['filter'] } : {}),
        ...(value.target !== undefined ? { target: value.target as UpdateEventSubscriptionPayload['target'] } : {}),
        ...(typeof value.run_as_role === 'string'
            ? { run_as_role: value.run_as_role as UpdateEventSubscriptionPayload['run_as_role'] }
            : {}),
        ...(typeof value.enabled === 'boolean' ? { enabled: value.enabled } : {}),
        ...(value.priority === 'high' || value.priority === 'normal' || value.priority === 'low'
            ? { priority: value.priority }
            : {}),
    };
}

async function findExistingSubscription(
    program: Command,
    payload: Record<string, unknown>,
): Promise<EventSubscription | undefined> {
    const id = getStringOption(payload.id);
    const client = await getClient(program);
    if (id) {
        return client.store.events.subscriptions.retrieve(id);
    }

    const name = getStringOption(payload.name);
    if (!name) {
        return undefined;
    }

    const subscriptions = await client.store.events.subscriptions.list();
    return subscriptions.find((subscription) => subscription.name === name);
}

export async function listEventSubscriptions(program: Command, _options: Record<string, unknown>) {
    const client = await getClient(program);
    printJson(await client.store.events.subscriptions.list());
}

export async function getEventSubscription(
    program: Command,
    subscriptionId: string,
    options: EventSubscriptionFileOptions,
) {
    const client = await getClient(program);
    const subscription = await client.store.events.subscriptions.retrieve(subscriptionId);
    writeOrPrint(subscription, getStringOption(options.file));
}

export async function createEventSubscription(program: Command, options: EventSubscriptionFileOptions) {
    const payload = toCreatePayload(readPayload(requireFile(options)));
    const client = await getClient(program);
    const response = await client.store.events.subscriptions.create(payload);
    console.log('Created event subscription', response.subscription.id);
    if (response.webhook_signing_secret) {
        console.log('Webhook signing secret', response.webhook_signing_secret);
    }
}

export async function updateEventSubscription(
    program: Command,
    subscriptionId: string,
    options: EventSubscriptionFileOptions,
) {
    const payload = toUpdatePayload(readPayload(requireFile(options)));
    const client = await getClient(program);
    const response = await client.store.events.subscriptions.update(subscriptionId, payload);
    console.log('Updated event subscription', response.subscription.id);
    if (response.webhook_signing_secret) {
        console.log('Webhook signing secret', response.webhook_signing_secret);
    }
}

export async function applyEventSubscription(
    program: Command,
    subscriptionId: string | undefined,
    options: EventSubscriptionFileOptions,
) {
    const payload = readPayload(requireFile(options));
    const client = await getClient(program);
    const existing = subscriptionId
        ? await client.store.events.subscriptions.retrieve(subscriptionId)
        : await findExistingSubscription(program, payload);

    if (existing) {
        const response = await client.store.events.subscriptions.update(existing.id, toUpdatePayload(payload));
        console.log('Updated event subscription', response.subscription.id);
        if (response.webhook_signing_secret) {
            console.log('Webhook signing secret', response.webhook_signing_secret);
        }
        return;
    }

    const response = await client.store.events.subscriptions.create(toCreatePayload(payload));
    console.log('Created event subscription', response.subscription.id);
    if (response.webhook_signing_secret) {
        console.log('Webhook signing secret', response.webhook_signing_secret);
    }
}

export async function deleteEventSubscription(
    program: Command,
    subscriptionId: string,
    _options: Record<string, unknown>,
) {
    const client = await getClient(program);
    printJson(await client.store.events.subscriptions.delete(subscriptionId));
}
