/**
 * The origin and path of a webhook URL, without credentials, query or fragment, which can carry secrets.
 * Dependency-free, so both the notifyWebhook activity and the workflow that calls it can use it.
 */
export function webhookLogTarget(url: string): string {
    try {
        const parsed = new URL(url);
        return `${parsed.origin}${parsed.pathname === '/' ? '' : parsed.pathname}`;
    } catch {
        return '[invalid webhook URL]';
    }
}
