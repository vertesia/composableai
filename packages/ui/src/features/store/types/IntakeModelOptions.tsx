import { getOptions, type ModelOptions, Providers } from '@llumiverse/common';
import type { InteractionExecutionConfiguration } from '@vertesia/common';
import { FormItem, useFetch } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import { ModelOptionsInputs } from '../../environment/ModelOptionsInputs.js';

export function IntakeModelOptions({
    config,
    onChange,
    readonly,
}: {
    config: InteractionExecutionConfiguration;
    onChange: (value: InteractionExecutionConfiguration | undefined) => void;
    readonly: boolean;
}) {
    const { client, project } = useUserSession();
    const { t } = useUITranslation();
    const environmentId = config.environment;
    const { data, error } = useFetch(async () => {
        if (!environmentId) return undefined;
        return { projectId: project?.id, environment: await client.environments.retrieve(environmentId) };
    }, [client, project?.id, environmentId]);
    const environment =
        data && data.projectId === project?.id && data.environment.id === config.environment
            ? data.environment
            : undefined;
    if (!environment || !config.model) {
        return error ? (
            <p role="status" className="mt-4 text-sm text-attention">
                {t('modelOptions.loadError')}
            </p>
        ) : null;
    }
    const provider = Object.values(Providers).find((item) => item === environment.provider);
    const metadata = getOptions(config.model, provider, config.model_options);
    return (
        <FormItem className="mt-4" label={t('modelOptions.title')}>
            <div className="grid gap-4 md:grid-cols-2">
                <ModelOptionsInputs
                    options={metadata.options}
                    modelConfig={config.model_options}
                    disabled={readonly}
                    isClearable
                    onChangeField={(name, value) => {
                        const modelOptions = {
                            ...config.model_options,
                            _option_id: metadata._option_id,
                        } as ModelOptions;
                        if (value === undefined) Reflect.deleteProperty(modelOptions, name);
                        else Reflect.set(modelOptions, name, value);
                        onChange({ ...config, model_options: modelOptions });
                    }}
                />
            </div>
        </FormItem>
    );
}
