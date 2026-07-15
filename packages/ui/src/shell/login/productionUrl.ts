/**
 * Resolve the URL of the production Vertesia web application for a given deployment region. Used by
 * the "restricted environment" sign-in step to send a user without early access to production, where
 * they do have access — in their own region, never another one (an EU user must not land on the US
 * site, and vice versa).
 *
 * Every production region follows one URL pattern — `https://cloud.{region}.vertesia.io/` (e.g.
 * `us1`, `us2`, `eu1`, `jp1`) — with no region special-cased. Only the legacy non-regional
 * deployment has no region and falls back to the apex `https://cloud.vertesia.io/`.
 *
 * Dev/ephemeral regions have no production site of their own — they mirror a production region — so
 * they are mapped to it first. Sending a rejected user to the dev host (e.g. `cloud.dev1.vertesia.io`)
 * would just bounce them back to the same restricted environment. `dev1` (us-central1) mirrors the
 * `us1` production region.
 *
 * Region is preferred over parsing the current hostname because it is well-defined for every serving
 * pattern (including the direct-routing `*.ui.{region}.vertesia.io` hosts, which carry no
 * `preview.`/`preprod.` prefix to strip). Callers pass `Env.region` from `@vertesia/ui/env`.
 */
const DEV_REGION_TO_PRODUCTION_REGION: Record<string, string> = {
    // dev1 (us-central1) is a dev mirror of the us1 production region.
    dev1: 'us1',
};

export function getProductionAppUrl(region?: string): string {
    const prodRegion = (region && DEV_REGION_TO_PRODUCTION_REGION[region]) || region;
    return prodRegion ? `https://cloud.${prodRegion}.vertesia.io/` : 'https://cloud.vertesia.io/';
}
