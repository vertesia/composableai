/**
 * Resolve the URL of the production Vertesia web application for a given deployment region. Used by
 * the "restricted environment" sign-in step to send a user without early access to production, where
 * they do have access — in their own region, never another one (an EU user must not land on the US
 * site, and vice versa).
 *
 * The mapping mirrors the server's `detectUiUrl` production branch (packages/server-common):
 *   - US (`us` / `us1`) or unknown region → `https://cloud.vertesia.io/` (canonical, non-regional)
 *   - any other region (e.g. `eu1`, `jp1`)  → `https://cloud.{region}.vertesia.io/`
 *
 * Region is preferred over parsing the current hostname because it is well-defined for every serving
 * pattern (including the direct-routing `*.ui.{region}.vertesia.io` hosts, which carry no
 * `preview.`/`preprod.` prefix to strip). Callers pass `Env.region` from `@vertesia/ui/env`.
 */
export function getProductionAppUrl(region?: string): string {
    const isNonUsRegion = region && region !== 'us' && region !== 'us1';
    return isNonUsRegion ? `https://cloud.${region}.vertesia.io/` : 'https://cloud.vertesia.io/';
}
