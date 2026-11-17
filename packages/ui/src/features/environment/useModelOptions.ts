import { getOptions, isBedrockApplicationInferenceProfile, type ModelOptions, Providers } from '@llumiverse/common';
import { useUserSession } from '@vertesia/ui/session';
import { useEffect, useMemo, useState } from 'react';

type SessionClient = ReturnType<typeof useUserSession>['client'];
type BackingModels = ReadonlyMap<string, string | undefined>;

/** A profile's backing model is fixed, but a profile added to the environment should show up without a reload. */
const CATALOG_TTL_MS = 5 * 60 * 1000;

/**
 * The backing models of each environment's catalog, per session client so that signing in again or switching
 * account starts from an empty cache. Editors that open together share one request, and a profile lookup costs
 * the provider several listing calls, so the catalog is fetched once per environment rather than once per editor.
 */
const catalogs = new WeakMap<SessionClient, Map<string, { expires: number; models: Promise<BackingModels> }>>();

function getBackingModels(
    client: SessionClient,
    projectId: string | undefined,
    environmentId: string,
): Promise<BackingModels> {
    let byEnvironment = catalogs.get(client);
    if (!byEnvironment) {
        byEnvironment = new Map();
        catalogs.set(client, byEnvironment);
    }
    const key = `${projectId ?? ''}/${environmentId}`;
    const cached = byEnvironment.get(key);
    if (cached && cached.expires > Date.now()) return cached.models;

    // Unfiltered: the cache answers for every profile in the environment, so it must hold the whole catalog.
    const models = client.environments
        .listModels(environmentId)
        .then((catalog): BackingModels => new Map(catalog.map(({ id, base_model_id }) => [id, base_model_id])));
    const entry = { expires: Date.now() + CATALOG_TTL_MS, models };
    byEnvironment.set(key, entry);
    // A failed lookup is retried by the next editor instead of being remembered.
    void models.catch(() => {
        if (byEnvironment.get(key) === entry) byEnvironment.delete(key);
    });
    return models;
}

export function useModelOptions(
    model: string | undefined,
    provider: Providers | undefined,
    options: ModelOptions | undefined,
    environmentId: string | undefined,
) {
    const { client, project } = useUserSession();
    const projectId = project?.id;
    const profileArn =
        provider === Providers.bedrock && model && isBedrockApplicationInferenceProfile(model) ? model : undefined;
    const [profile, setProfile] = useState<{
        client: typeof client;
        projectId: string | undefined;
        environmentId: string;
        arn: string;
        baseModelId: string | undefined;
    }>();

    useEffect(() => {
        if (!environmentId || !profileArn) return;
        let current = true;
        const setBaseModel = (baseModelId: string | undefined) => {
            if (current) setProfile({ client, projectId, environmentId, arn: profileArn, baseModelId });
        };
        void getBackingModels(client, projectId, environmentId).then(
            (models) => setBaseModel(models.get(profileArn)),
            () => setBaseModel(undefined),
        );
        return () => {
            current = false;
        };
    }, [client, projectId, environmentId, profileArn]);

    const baseModelId =
        profile?.client === client &&
        profile.projectId === projectId &&
        profile.environmentId === environmentId &&
        profile.arn === profileArn
            ? profile.baseModelId
            : undefined;
    return useMemo(
        () =>
            getOptions(
                baseModelId && model ? { id: model, base_model_id: baseModelId } : (model ?? ''),
                provider,
                options,
            ),
        [model, provider, options, baseModelId],
    );
}
