/**
 * Resolve the URL of the production Vertesia web application for a given deployment region. Used by
 * the "restricted environment" sign-in step to send a user without early access to production, where
 * they do have access — in their own region, never another one (an EU user must not land on the US
 * site, and vice versa).
 *
 * The mapping mirrors the server's `detectUiUrl` production branch (packages/server-common):
 *   - US (`us` / `us1`) or unknown region → `https://cloud.vertesia.io/` (canonical, non-regional)
 *   - any other production region (e.g. `eu1`, `jp1`) → `https://cloud.{region}.vertesia.io/`
 *
 * Dev/ephemeral regions have no production site of their own — they mirror a production region — so
 * they are mapped to that region's production URL. Sending a rejected user to the dev host (e.g.
 * `cloud.dev1.vertesia.io`) would just bounce them back to the same restricted environment. `dev1`
 * (us-central1) mirrors the `us1` production region.
 *
 * Region is preferred over parsing the current hostname because it is well-defined for every serving
 * pattern (including the direct-routing `*.ui.{region}.vertesia.io` hosts, which carry no
 * `preview.`/`preprod.` prefix to strip). Callers pass `Env.region` from `@vertesia/ui/env`.
 */
const DEV_REGION_PRODUCTION_URL: Record<string, string> = {
    // dev1 (us-central1) is a dev mirror of the us1 production region.
    dev1: 'https://cloud.us1.vertesia.io/',
};

export function getProductionAppUrl(region?: string): string {
    if (region && DEV_REGION_PRODUCTION_URL[region]) {
        return DEV_REGION_PRODUCTION_URL[region];
    }
    const isNonUsRegion = region && region !== 'us' && region !== 'us1';
    return isNonUsRegion ? `https://cloud.${region}.vertesia.io/` : 'https://cloud.vertesia.io/';
}
