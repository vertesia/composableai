import type { ExecutionEnvironmentRef, Project } from '@vertesia/common';
import { Button, Popover, PopoverContent, PopoverTrigger, SelectBox, Spinner } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

export interface DocumentEditingConfiguration {
    environment?: string;
    model?: string;
}

interface ModelOption {
    id: string;
    name: string;
}

export function getDocumentEditingProjectDefault(
    project: Pick<Project, 'configuration'>,
): DocumentEditingConfiguration {
    const defaults = project.configuration?.defaults?.system?.agent ?? project.configuration?.defaults?.base;
    return {
        environment: defaults?.environment,
        model: defaults?.model,
    };
}

function environmentLabel(environment: ExecutionEnvironmentRef): string {
    return environment.name;
}

function modelLabel(model: ModelOption): string {
    return model.name;
}

interface DocumentEditingConfigurationSelectorProps {
    value: DocumentEditingConfiguration;
    onChange: (value: DocumentEditingConfiguration) => void;
    disabled?: boolean;
    isLoading?: boolean;
}

export function DocumentEditingConfigurationSelector({
    value,
    onChange,
    disabled = false,
    isLoading = false,
}: DocumentEditingConfigurationSelectorProps) {
    const { client } = useUserSession();
    const { t } = useUITranslation();
    const [environments, setEnvironments] = useState<ExecutionEnvironmentRef[]>([]);
    const [models, setModels] = useState<ModelOption[]>([]);
    const [isLoadingEnvironments, setIsLoadingEnvironments] = useState(true);
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    const latestEnvironmentRequestRef = useRef<string | undefined>(undefined);

    useEffect(() => {
        let cancelled = false;
        setIsLoadingEnvironments(true);
        void client.environments
            .list()
            .then((items) => {
                if (!cancelled) setEnvironments(items.slice().sort((a, b) => a.name.localeCompare(b.name)));
            })
            .catch((err: unknown) => {
                console.warn('Failed to list document editing environments', err);
                if (!cancelled) setEnvironments([]);
            })
            .finally(() => {
                if (!cancelled) setIsLoadingEnvironments(false);
            });
        return () => {
            cancelled = true;
        };
    }, [client]);

    useEffect(() => {
        if (!value.environment) {
            setModels([]);
            setIsLoadingModels(false);
            return;
        }

        let cancelled = false;
        const environmentId = value.environment;
        setIsLoadingModels(true);
        void client.environments
            .retrieve(environmentId)
            .then((environment) => {
                if (cancelled) return;
                setModels(
                    (environment.enabled_models ?? [])
                        .map((model) => ({ id: model.id, name: model.name || model.id }))
                        .sort((a, b) => a.name.localeCompare(b.name)),
                );
            })
            .catch((err: unknown) => {
                console.warn('Failed to load document editing models', err);
                if (!cancelled) setModels([]);
            })
            .finally(() => {
                if (!cancelled) setIsLoadingModels(false);
            });
        return () => {
            cancelled = true;
        };
    }, [client, value.environment]);

    const selectedEnvironment = environments.find((environment) => environment.id === value.environment);
    const selectedModel = useMemo<ModelOption | undefined>(() => {
        if (!value.model) return undefined;
        return models.find((model) => model.id === value.model) ?? { id: value.model, name: value.model };
    }, [models, value.model]);

    const selectEnvironment = (environment: ExecutionEnvironmentRef) => {
        latestEnvironmentRequestRef.current = environment.id;
        onChange({ environment: environment.id });
        void client.environments
            .retrieve(environment.id)
            .then((details) => {
                if (latestEnvironmentRequestRef.current !== environment.id) return;
                const nextModel = details.default_model ?? details.enabled_models?.[0]?.id;
                onChange({ environment: environment.id, model: nextModel });
            })
            .catch((err: unknown) => {
                console.warn('Failed to select a default document editing model', err);
            });
    };

    const selectModel = (model: ModelOption) => {
        latestEnvironmentRequestRef.current = undefined;
        onChange({ environment: value.environment, model: model.id });
    };

    const buttonLabel = value.model || t('agent.documentEditingSelectModel');

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 max-w-[15rem] gap-1.5 px-2 text-xs"
                    aria-label={t('agent.documentEditingConfiguration')}
                    title={t('agent.documentEditingConfiguration')}
                >
                    {isLoading ? <Spinner size="sm" /> : <SlidersHorizontal className="size-3.5 shrink-0" />}
                    <span className="min-w-0 truncate">{buttonLabel}</span>
                    <ChevronDown className="size-3.5 shrink-0 opacity-70" />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="z-[1000000] w-80 space-y-3 p-3">
                <div>
                    <div className="text-sm font-semibold text-foreground">
                        {t('agent.documentEditingConfiguration')}
                    </div>
                    <div className="mt-0.5 text-xs leading-4 text-muted">
                        {disabled
                            ? t('agent.documentEditingConfigurationLocked')
                            : t('agent.documentEditingConfigurationDescription')}
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground" htmlFor="document-editing-environment">
                        {t('agent.environment')}
                    </label>
                    <SelectBox
                        id="document-editing-environment"
                        by="id"
                        options={environments}
                        value={selectedEnvironment}
                        optionLabel={environmentLabel}
                        filterBy="name"
                        placeholder={t('agent.documentEditingSelectEnvironment')}
                        onChange={selectEnvironment}
                        disabled={disabled}
                        isLoading={isLoadingEnvironments}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground" htmlFor="document-editing-model">
                        {t('agent.model')}
                    </label>
                    <SelectBox
                        id="document-editing-model"
                        by="id"
                        options={models}
                        value={selectedModel}
                        optionLabel={modelLabel}
                        filterBy="name"
                        placeholder={t('agent.documentEditingSelectModel')}
                        onChange={selectModel}
                        disabled={disabled || !value.environment}
                        isLoading={isLoadingModels}
                        warnOnMissingValue={false}
                    />
                </div>
            </PopoverContent>
        </Popover>
    );
}
