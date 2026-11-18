import {
    getOptions,
    isBedrockApplicationInferenceProfile,
    type ModelOptions,
    type ModelOptionsInfo,
    Providers,
} from '@llumiverse/common';
import { useUserSession } from '@vertesia/ui/session';
import { useEffect, useMemo, useState } from 'react';

type SessionClient = ReturnType<typeof useUserSession>['client'];
type BackingModels = ReadonlyMap<string, string | undefined>;
interface Catalog {
    expires: number;
    models: Promise<BackingModels>;
    /** Set once the catalog has loaded, so a render can read it without waiting. */
    resolved?: BackingModels;
}

/** A profile's backing model is fixed; the expiry only bounds how long the catalog is reused. */
const CATALOG_TTL_MS = 5 * 60 * 1000;

/**
 * The backing models of each environment's catalog, per session client so that signing in again or switching
 * account starts from an empty cache. Editors that open together share one request, and a profile lookup costs
 * the provider several listing calls, so the catalog is fetched once per environment rather than once per editor.
 */
const catalogs = new WeakMap<SessionClient, Map<string, Catalog>>();

function catalogKey(projectId: string | undefined, environmentId: string) {
    return `${projectId ?? ''}/${environmentId}`;
}

function peekCatalog(client: SessionClient, projectId: string | undefined, environmentId: string) {
    const cached = catalogs.get(client)?.get(catalogKey(projectId, environmentId));
    return cached && cached.expires > Date.now() ? cached : undefined;
}

/** Returns the cached catalog, or fetches it; `stale` names an entry known to be outdated, which is replaced. */
function getCatalog(
    client: SessionClient,
    projectId: string | undefined,
    environmentId: string,
    stale?: Catalog,
): Catalog {
    const cached = peekCatalog(client, projectId, environmentId);
    if (cached && cached !== stale) return cached;

    let byEnvironment = catalogs.get(client);
    if (!byEnvironment) {
        byEnvironment = new Map();
        catalogs.set(client, byEnvironment);
    }
    const key = catalogKey(projectId, environmentId);
    const entry = { expires: Date.now() + CATALOG_TTL_MS } as Catalog;
    // Unfiltered: the cache answers for every profile in the environment, so it must hold the whole catalog.
    entry.models = client.environments.listModels(environmentId).then((catalog) => {
        const models = new Map(catalog.map(({ id, base_model_id }) => [id, base_model_id]));
        entry.resolved = models;
        return models;
    });
    byEnvironment.set(key, entry);
    // A failed lookup is retried by the next editor instead of being remembered.
    void entry.models.catch(() => {
        if (byEnvironment.get(key) === entry) byEnvironment.delete(key);
    });
    return entry;
}

async function lookUpBackingModel(
    client: SessionClient,
    projectId: string | undefined,
    environmentId: string,
    profileArn: string,
): Promise<string | undefined> {
    const catalog = getCatalog(client, projectId, environmentId);
    // A catalog that had loaded before this lookup may predate the profile being enabled: fetch it again once.
    const loadedEarlier = catalog.resolved !== undefined;
    const models = await catalog.models;
    if (models.has(profileArn) || !loadedEarlier) return models.get(profileArn);
    return (await getCatalog(client, projectId, environmentId, catalog).models).get(profileArn);
}

/**
 * The option schema for a model. For a Bedrock application inference profile, the tiers come from the profile's
 * backing model, which is looked up in the environment catalog. `pending` is true until that lookup answers;
 * editors must not reconcile saved options against the interim schema, which offers every tier.
 */
export function useModelOptions(
    model: string | undefined,
    provider: Providers | undefined,
    options: ModelOptions | undefined,
    environmentId: string | undefined,
): ModelOptionsInfo & { pending: boolean } {
    const { client, project } = useUserSession();
    const projectId = project?.id;
    const profileArn =
        provider === Providers.bedrock && model && isBedrockApplicationInferenceProfile(model) ? model : undefined;
    // A new token each time the selection changes, even back to an earlier profile: only an answer to the lookup
    // started for this selection ends `pending`. Matching on the profile alone would reuse an earlier failed answer.
    // biome-ignore lint/correctness/useExhaustiveDependencies: the dependencies define the selection the token names.
    const attempt = useMemo(() => ({}), [client, projectId, environmentId, profileArn]);
    const [answer, setAnswer] = useState<{ attempt: object; baseModelId: string | undefined }>();

    const warm = profileArn && environmentId ? peekCatalog(client, projectId, environmentId)?.resolved : undefined;
    const warmHit = !!profileArn && !!warm?.has(profileArn);

    useEffect(() => {
        if (!environmentId || !profileArn || warmHit) return;
        let current = true;
        const setBaseModel = (baseModelId: string | undefined) => {
            if (current) setAnswer({ attempt, baseModelId });
        };
        void lookUpBackingModel(client, projectId, environmentId, profileArn).then(setBaseModel, () =>
            setBaseModel(undefined),
        );
        return () => {
            current = false;
        };
    }, [attempt, client, projectId, environmentId, profileArn, warmHit]);

    const answered = answer?.attempt === attempt;
    const baseModelId = warmHit && profileArn ? warm?.get(profileArn) : answered ? answer.baseModelId : undefined;
    const pending = !!profileArn && !!environmentId && !warmHit && !answered;
    return useMemo(
        () => ({
            ...getOptions(
                baseModelId && model ? { id: model, base_model_id: baseModelId } : (model ?? ''),
                provider,
                options,
            ),
            pending,
        }),
        [model, provider, options, baseModelId, pending],
    );
}
