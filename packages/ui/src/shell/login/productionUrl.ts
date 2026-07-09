/**
 * Resolve the URL of the production Vertesia web application for the current (preview/preprod)
 * host. Used by the "restricted environment" sign-in step to redirect a user without
 * early-access to production, where they do have access.
 *
 * Host patterns (see `apps/composable-ui/src/env.ts` `detectHost`):
 *   preview.cloud.{region}.vertesia.io  → cloud.{region}.vertesia.io
 *   preprod.cloud.{region}.vertesia.io  → cloud.{region}.vertesia.io
 *   preview.cloud.vertesia.io (legacy)  → cloud.vertesia.io
 *   preprod.cloud.vertesia.io (legacy)  → cloud.vertesia.io
 *
 * A host that does not carry a `preview`/`preprod` prefix (localhost, dev, tenant subdomain, …)
 * falls back to the canonical production URL.
 */
export function getProductionAppUrl(hostname: string = window.location.hostname): string {
    const production = hostname.replace(/^(preview|preprod)\./, '');
    if (production === hostname) {
        return 'https://cloud.vertesia.io/';
    }
    return `https://${production}/`;
}
