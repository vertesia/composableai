import { EventSourceProvider } from './execute.js';

export type ManagedEventSourceStatus = 'connecting' | 'open' | 'reconnecting' | 'closed';

export interface ManagedEventSourceEvent<T> {
    data: T;
    event_type: string;
    event_id?: string;
}

export interface ManagedEventSourceConnection {
    readonly closed: boolean;
    close(): void;
}

export interface ManagedEventSourceOptions<T> {
    url: URL | string | (() => URL | string | Promise<URL | string>);
    event_types?: string[];
    signal?: AbortSignal;
    max_reconnect_attempts?: number;
    base_reconnect_delay_ms?: number;
    max_reconnect_delay_ms?: number;
    last_event_id_query_param?: string;
    get_access_token?: () => Promise<string | undefined>;
    parse?: (data: string, eventType: string) => T;
    get_cursor?: (data: T) => string | undefined;
    on_event: (event: ManagedEventSourceEvent<T>) => void;
    on_error?: (error: unknown) => void;
    on_status?: (status: ManagedEventSourceStatus) => void;
}

function defaultParse<T>(data: string): T {
    return JSON.parse(data) as T;
}

function calculateBackoffDelay(attempts: number, baseDelayMs: number, maxDelayMs: number): number {
    const exponentialDelay = Math.min(baseDelayMs * 2 ** attempts, maxDelayMs);
    const jitter = Math.random() * 0.1 * exponentialDelay;
    return exponentialDelay + jitter;
}

function withAccessToken(url: URL, bearerToken: string | undefined): void {
    if (!bearerToken) {
        return;
    }
    const token = bearerToken.startsWith('Bearer ') ? bearerToken.slice('Bearer '.length) : bearerToken;
    url.searchParams.set('access_token', token);
}

async function resolveUrl(value: ManagedEventSourceOptions<unknown>['url']): Promise<URL> {
    const resolved = typeof value === 'function' ? await value() : value;
    return resolved instanceof URL ? new URL(resolved.href) : new URL(resolved);
}

export function openManagedEventSource<T>(options: ManagedEventSourceOptions<T>): ManagedEventSourceConnection {
    const eventTypes = options.event_types?.length ? options.event_types : ['message'];
    const maxReconnectAttempts = options.max_reconnect_attempts ?? 10;
    const baseDelayMs = options.base_reconnect_delay_ms ?? 1000;
    const maxDelayMs = options.max_reconnect_delay_ms ?? 30_000;
    const parse = options.parse ?? defaultParse<T>;

    let closed = false;
    let reconnectAttempts = 0;
    let currentSse: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let abortHandler: (() => void) | null = null;
    let connectionOpenedAt = 0;
    let lastEventId: string | undefined;

    const emitStatus = (status: ManagedEventSourceStatus) => {
        options.on_status?.(status);
    };

    const cleanupCurrentSource = () => {
        if (currentSse) {
            currentSse.close();
            currentSse = null;
        }
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
    };

    const close = () => {
        if (closed) {
            return;
        }
        closed = true;
        cleanupCurrentSource();
        if (options.signal && abortHandler) {
            options.signal.removeEventListener('abort', abortHandler);
            abortHandler = null;
        }
        emitStatus('closed');
    };

    const scheduleReconnect = (error: unknown) => {
        if (closed) {
            return;
        }
        cleanupCurrentSource();
        const connectionDuration = connectionOpenedAt ? Date.now() - connectionOpenedAt : 0;
        if (connectionDuration > 5000) {
            reconnectAttempts = 0;
        }
        if (reconnectAttempts >= maxReconnectAttempts) {
            close();
            options.on_error?.(error);
            return;
        }
        const delay = calculateBackoffDelay(reconnectAttempts, baseDelayMs, maxDelayMs);
        reconnectAttempts += 1;
        emitStatus('reconnecting');
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            void connect(true);
        }, delay);
    };

    const handleMessage = (eventType: string, ev: MessageEvent) => {
        if (closed || !ev.data || String(ev.data).startsWith(':')) {
            return;
        }
        try {
            const data = parse(String(ev.data), eventType);
            const cursor = options.get_cursor?.(data);
            lastEventId = ev.lastEventId || cursor || lastEventId;
            options.on_event({
                data,
                event_type: eventType,
                event_id: ev.lastEventId || cursor,
            });
        } catch (err) {
            options.on_error?.(err);
        }
    };

    const connect = async (isReconnect: boolean) => {
        if (closed) {
            return;
        }
        try {
            emitStatus(isReconnect ? 'reconnecting' : 'connecting');
            const EventSourceImpl = await EventSourceProvider();
            if (closed) {
                return;
            }
            const url = await resolveUrl(options.url);
            if (
                lastEventId &&
                options.last_event_id_query_param &&
                !url.searchParams.has(options.last_event_id_query_param)
            ) {
                url.searchParams.set(options.last_event_id_query_param, lastEventId);
            }
            withAccessToken(url, await options.get_access_token?.());
            if (closed) {
                return;
            }
            const sse = new EventSourceImpl(url.href);
            currentSse = sse;
            connectionOpenedAt = 0;

            sse.onopen = () => {
                connectionOpenedAt = Date.now();
                emitStatus('open');
            };

            for (const eventType of eventTypes) {
                sse.addEventListener(eventType, (ev) => handleMessage(eventType, ev as MessageEvent));
            }

            sse.onerror = (err: unknown) => {
                scheduleReconnect(err);
            };
        } catch (err) {
            scheduleReconnect(err);
        }
    };

    if (options.signal) {
        if (options.signal.aborted) {
            closed = true;
            emitStatus('closed');
            return {
                get closed() {
                    return closed;
                },
                close,
            };
        }
        abortHandler = close;
        options.signal.addEventListener('abort', abortHandler, { once: true });
    }

    void connect(false);

    return {
        get closed() {
            return closed;
        },
        close,
    };
}
