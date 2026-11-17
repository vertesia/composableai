import { getOptions, isBedrockApplicationInferenceProfile, type ModelOptions, Providers } from '@llumiverse/common';
import { useUserSession } from '@vertesia/ui/session';
import { useEffect, useMemo, useState } from 'react';

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
        void client.environments.listModels(environmentId, { text: profileArn }).then(
            (models) => setBaseModel(models.find(({ id }) => id === profileArn)?.base_model_id),
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
        () => getOptions(model ?? '', provider, options, baseModelId),
        [model, provider, options, baseModelId],
    );
}
