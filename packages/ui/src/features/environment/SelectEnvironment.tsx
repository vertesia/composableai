import type { ExecutionEnvironmentRef } from '@vertesia/common';
import { SelectBox, useFetch, useFetchOnce } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import { useEffect, useState } from 'react';

type EnvironmentModel = NonNullable<ExecutionEnvironmentRef['enabled_models']>[number];

function environmentLabel(option: ExecutionEnvironmentRef) {
    return option.name;
}

interface SelectEnvironmentProps {
    onChange: (environment?: ExecutionEnvironmentRef) => void;
    isClearable?: boolean;
    ignoreVirtuals?: boolean;
    selectedEnvId?: string;
    disabled?: boolean;
}

export function SelectEnvironment({
    isClearable = false,
    onChange,
    ignoreVirtuals = false,
    selectedEnvId,
    disabled = false,
}: SelectEnvironmentProps) {
    const { t } = useUITranslation();
    const { client } = useUserSession();
    const [value, setValue] = useState<ExecutionEnvironmentRef | undefined>();
    const { data: environments, isLoading } = useFetchOnce(() =>
        client.environments.list().then((result) => {
            const available = ignoreVirtuals
                ? result.filter((environment) => !environment.provider.startsWith('virtual_'))
                : result;
            return available.slice().sort((left, right) => left.name.localeCompare(right.name));
        }),
    );

    useEffect(() => {
        setValue(environments?.find((environment) => environment.id === selectedEnvId));
    }, [environments, selectedEnvId]);

    return (
        <SelectBox
            isClearable={isClearable}
            optionLabel={environmentLabel}
            options={environments ?? []}
            value={value}
            onChange={(environment) => {
                setValue(environment);
                onChange(environment);
            }}
            placeholder={t('intakePolicy.placeholder.environment')}
            filterBy="name"
            disabled={disabled}
            isLoading={isLoading}
        />
    );
}

function modelLabel(option: EnvironmentModel) {
    return option.name;
}

function createModelLabel(greyedModels?: EnvironmentModel[]) {
    if (!greyedModels?.length) {
        return modelLabel;
    }
    return (option: EnvironmentModel) => {
        const isGreyed = greyedModels.some((model) => model.id === option.id);
        return <span className={isGreyed ? 'opacity-50' : ''}>{option.name}</span>;
    };
}

interface SelectModelProps {
    envId: string | undefined;
    onChange: (model?: EnvironmentModel) => void;
    isClearable?: boolean;
    selectedModelId?: string;
    disabled?: boolean;
    greyedModels?: EnvironmentModel[];
    onModelsLoaded?: (models: EnvironmentModel[]) => void;
}

export function SelectModel({
    envId,
    isClearable,
    onChange,
    selectedModelId,
    disabled = false,
    greyedModels,
    onModelsLoaded,
}: SelectModelProps) {
    const { t } = useUITranslation();
    const { client } = useUserSession();
    const [value, setValue] = useState<EnvironmentModel | undefined>();
    const { data: models, isLoading } = useFetch(async () => {
        if (!envId) {
            return [];
        }
        try {
            const environment = await client.environments.retrieve(envId);
            return [...(environment.enabled_models ?? [])].sort((left, right) => left.name.localeCompare(right.name));
        } catch {
            return [];
        }
    }, [envId]);

    useEffect(() => {
        if (!selectedModelId) {
            setValue(undefined);
            return;
        }
        const selected = models?.find((model) => model.id === selectedModelId);
        setValue(
            selected ?? {
                id: selectedModelId,
                name: selectedModelId,
                provider: 'unknown',
            },
        );
    }, [models, selectedModelId]);

    useEffect(() => {
        if (models) {
            onModelsLoaded?.(models);
        }
    }, [models, onModelsLoaded]);

    return (
        <SelectBox
            isClearable={isClearable}
            by="id"
            optionLabel={createModelLabel(greyedModels)}
            options={models ?? []}
            value={value}
            onChange={(model) => {
                setValue(model);
                onChange(model);
            }}
            placeholder={t('intakePolicy.placeholder.model')}
            disabled={disabled}
            isLoading={isLoading}
        />
    );
}

interface SelectTrainingModelProps {
    env: ExecutionEnvironmentRef | undefined;
    onChange: (model?: EnvironmentModel) => void;
    isClearable?: boolean;
}

export function SelectTrainingModel({ env, isClearable, onChange }: SelectTrainingModelProps) {
    const { t } = useUITranslation();
    const { client } = useUserSession();
    const [value, setValue] = useState<EnvironmentModel | undefined>();
    const { data: models, isLoading } = useFetch(async () => {
        if (!env) {
            return [];
        }
        try {
            return client.environments.listTrainableModels(env.id);
        } catch {
            return [];
        }
    }, [env?.id]);

    return (
        <SelectBox
            isClearable={isClearable}
            by="id"
            optionLabel={modelLabel}
            options={models ?? []}
            value={value}
            onChange={(model) => {
                setValue(model);
                onChange(model);
            }}
            placeholder={t('intakePolicy.placeholder.model')}
            disabled={!env}
            isLoading={isLoading}
        />
    );
}
