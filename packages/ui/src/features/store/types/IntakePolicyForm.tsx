import type {
    ContentTypeIntakePolicy,
    IntakePageRanges,
    IntakeVisionDetail,
    InteractionExecutionConfiguration,
} from '@vertesia/common';
import { Button, FormItem, Input, NumberInput, SelectBox, TagsInput, Textarea, VTooltip } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { Plus, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { SelectEnvironment, SelectModel } from '../../environment/SelectEnvironment.js';
import {
    type IntakePolicyPath,
    replaceIntakeRange,
    updateExecutionEnvironment,
    updateExecutionModel,
    updateIntakePolicy,
} from './intake-policy-editor.logic.js';

export type IntakePolicyFormSection = 'overview' | 'conversion' | 'extraction' | 'grounding' | 'output';

interface IntakePolicyFormProps {
    policy: ContentTypeIntakePolicy;
    section: IntakePolicyFormSection;
    onChange: (policy: ContentTypeIntakePolicy) => void;
    readonly?: boolean;
}

interface SelectOption<T extends string | number> {
    value: T;
    label: string;
}

export function IntakePolicyForm({ policy, section, onChange, readonly = false }: IntakePolicyFormProps) {
    const { t } = useUITranslation();
    const setValue = (path: IntakePolicyPath, value: unknown) => onChange(updateIntakePolicy(policy, path, value));

    if (section === 'overview') {
        return (
            <FormSurface>
                <FormSection title={t('intakePolicy.section.classification')}>
                    <div className="grid gap-4 md:grid-cols-2">
                        <SelectField
                            label={t('intakePolicy.field.mode')}
                            description={t('intakePolicy.help.mode')}
                            value={policy.mode}
                            options={options(t, ['programmatic', 'agentic'])}
                            onChange={(value) => setValue(['mode'], value)}
                            readonly={readonly}
                        />
                        <SelectField
                            label={t('intakePolicy.field.defaultView')}
                            value={policy.default_view}
                            options={options(t, ['auto', 'text', 'pdf', 'image', 'properties'])}
                            onChange={(value) => setValue(['default_view'], value)}
                            readonly={readonly}
                        />
                    </div>
                    <TextAreaField
                        label={t('intakePolicy.field.identificationGuidance')}
                        description={t('intakePolicy.help.identificationGuidance')}
                        value={policy.identification?.guidance}
                        onChange={(value) => setValue(['identification', 'guidance'], value)}
                        readonly={readonly}
                    />
                    <TextAreaField
                        label={t('intakePolicy.field.distinguishFrom')}
                        value={policy.identification?.distinguish_from}
                        onChange={(value) => setValue(['identification', 'distinguish_from'], value)}
                        readonly={readonly}
                    />
                    <FormItem label={t('intakePolicy.field.examples')} description={t('intakePolicy.help.examples')}>
                        <TagsInput
                            options={policy.identification?.examples ?? []}
                            value={policy.identification?.examples ?? []}
                            onChange={(value) =>
                                setValue(['identification', 'examples'], value.length ? value : undefined)
                            }
                            onOptionsChange={(value) =>
                                setValue(['identification', 'examples'], value.length ? value : undefined)
                            }
                            creatable
                            disabled={readonly}
                            placeholder={t('intakePolicy.placeholder.objectId')}
                        />
                    </FormItem>
                </FormSection>

                <FormSection title={t('intakePolicy.section.locate')} last>
                    <TextAreaField
                        label={t('intakePolicy.field.locateInstructions')}
                        description={t('intakePolicy.help.locateInstructions')}
                        value={policy.locate?.instructions}
                        onChange={(value) =>
                            setValue(['locate'], value ? { ...policy.locate, instructions: value } : undefined)
                        }
                        readonly={readonly}
                    />
                    <div className="grid gap-4 md:grid-cols-2">
                        <SelectField
                            label={t('intakePolicy.field.contactSheetDetail')}
                            value={policy.locate?.detail}
                            options={[
                                { value: 8, label: t('intakePolicy.option.pagesPerSheet', { count: 8 }) },
                                { value: 16, label: t('intakePolicy.option.pagesPerSheet', { count: 16 }) },
                            ]}
                            onChange={(value) => setValue(['locate', 'detail'], value)}
                            readonly={readonly || !policy.locate}
                        />
                        <NumberField
                            label={t('intakePolicy.field.locateMinPages')}
                            value={policy.locate?.min_pages}
                            min={0}
                            onChange={(value) => setValue(['locate', 'min_pages'], value)}
                            readonly={readonly || !policy.locate}
                        />
                    </div>
                </FormSection>
            </FormSurface>
        );
    }

    if (section === 'conversion') {
        return (
            <FormSurface>
                <FormSection title={t('intakePolicy.section.conversion')}>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <TriStateField
                            label={t('intakePolicy.field.enabled')}
                            value={policy.text_conversion?.enabled}
                            onChange={(value) => setValue(['text_conversion', 'enabled'], value)}
                            readonly={readonly}
                        />
                        <SelectField
                            label={t('intakePolicy.field.method')}
                            value={policy.text_conversion?.method}
                            options={options(t, ['auto', 'basic', 'llm', 'custom'])}
                            onChange={(value) => setValue(['text_conversion', 'method'], value)}
                            readonly={readonly}
                        />
                        <SelectField
                            label={t('intakePolicy.field.outputFormat')}
                            value={policy.text_conversion?.output_format}
                            options={options(t, ['markdown', 'text'])}
                            onChange={(value) => setValue(['text_conversion', 'output_format'], value)}
                            readonly={readonly}
                        />
                        <SelectField
                            label={t('intakePolicy.field.pageScope')}
                            value={policy.text_conversion?.scope}
                            options={options(t, ['all', 'located'])}
                            onChange={(value) => setValue(['text_conversion', 'scope'], value)}
                            readonly={readonly}
                        />
                    </div>
                    <TextAreaField
                        label={t('intakePolicy.field.instructions')}
                        value={policy.text_conversion?.instructions}
                        onChange={(value) => setValue(['text_conversion', 'instructions'], value)}
                        readonly={readonly}
                    />
                </FormSection>

                {policy.text_conversion?.method === 'custom' && (
                    <FormSection title={t('intakePolicy.section.customConversion')}>
                        <div className="grid gap-4 md:grid-cols-2">
                            <InputField
                                label={t('intakePolicy.field.interaction')}
                                value={policy.text_conversion.custom?.interaction}
                                onChange={(value) => setValue(['text_conversion', 'custom', 'interaction'], value)}
                                readonly={readonly}
                            />
                            <InputField
                                label={t('intakePolicy.field.agent')}
                                value={policy.text_conversion.custom?.agent}
                                onChange={(value) => setValue(['text_conversion', 'custom', 'agent'], value)}
                                readonly={readonly}
                            />
                        </div>
                    </FormSection>
                )}

                <FormSection title={t('intakePolicy.section.pageRanges')} last>
                    <PageRangesField
                        value={policy.text_conversion?.page_ranges}
                        onChange={(value) => setValue(['text_conversion', 'page_ranges'], value)}
                        readonly={readonly}
                    />
                </FormSection>
            </FormSurface>
        );
    }

    if (section === 'extraction') {
        return (
            <FormSurface>
                <FormSection title={t('intakePolicy.section.extraction')}>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <TriStateField
                            label={t('intakePolicy.field.enabled')}
                            value={policy.extraction?.enabled}
                            onChange={(value) => setValue(['extraction', 'enabled'], value)}
                            readonly={readonly}
                        />
                        <SelectField
                            label={t('intakePolicy.field.source')}
                            value={policy.extraction?.source}
                            options={options(t, ['auto', 'text', 'vision', 'mixed'])}
                            onChange={(value) => setValue(['extraction', 'source'], value)}
                            readonly={readonly}
                        />
                        <SelectField
                            label={t('intakePolicy.field.pageScope')}
                            value={policy.extraction?.scope}
                            options={options(t, ['all', 'located'])}
                            onChange={(value) => setValue(['extraction', 'scope'], value)}
                            readonly={readonly}
                        />
                        <NumberField
                            label={t('intakePolicy.field.maxPages')}
                            value={policy.extraction?.max_pages}
                            min={1}
                            onChange={(value) => setValue(['extraction', 'max_pages'], value)}
                            readonly={readonly}
                        />
                    </div>
                    <InputField
                        label={t('intakePolicy.field.interaction')}
                        value={policy.extraction?.interaction}
                        onChange={(value) => setValue(['extraction', 'interaction'], value)}
                        readonly={readonly}
                    />
                    <TextAreaField
                        label={t('intakePolicy.field.instructions')}
                        value={policy.extraction?.instructions}
                        onChange={(value) => setValue(['extraction', 'instructions'], value)}
                        readonly={readonly}
                    />
                    <PageRangesField
                        value={policy.extraction?.page_ranges}
                        onChange={(value) => setValue(['extraction', 'page_ranges'], value)}
                        readonly={readonly}
                    />
                </FormSection>

                <FormSection title={t('intakePolicy.section.visionBudget')}>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <SelectField
                            label={t('intakePolicy.field.defaultDetail')}
                            value={policy.extraction?.vision?.default_detail}
                            options={options(t, ['low', 'standard', 'high'])}
                            onChange={(value) => setValue(['extraction', 'vision', 'default_detail'], value)}
                            readonly={readonly}
                        />
                        <VisionDetailsField
                            value={policy.extraction?.vision?.allowed_details}
                            onChange={(value) => setValue(['extraction', 'vision', 'allowed_details'], value)}
                            readonly={readonly}
                        />
                        <NumberField
                            label={t('intakePolicy.field.maxImageTokens')}
                            value={policy.extraction?.vision?.max_image_tokens}
                            min={1}
                            onChange={(value) => setValue(['extraction', 'vision', 'max_image_tokens'], value)}
                            readonly={readonly}
                        />
                        <NumberField
                            label={t('intakePolicy.field.maxPayloadMb')}
                            value={policy.extraction?.vision?.max_payload_mb}
                            min={1}
                            onChange={(value) => setValue(['extraction', 'vision', 'max_payload_mb'], value)}
                            readonly={readonly}
                        />
                        <NumberField
                            label={t('intakePolicy.field.maxPagesPerCall')}
                            value={policy.extraction?.vision?.max_pages_per_call}
                            min={1}
                            onChange={(value) => setValue(['extraction', 'vision', 'max_pages_per_call'], value)}
                            readonly={readonly}
                        />
                    </div>
                </FormSection>

                <FormSection title={t('intakePolicy.section.verification')} last>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <TriStateField
                            label={t('intakePolicy.field.enabled')}
                            value={policy.extraction?.verification?.enabled}
                            onChange={(value) => setValue(['extraction', 'verification', 'enabled'], value)}
                            readonly={readonly}
                        />
                        <InputField
                            label={t('intakePolicy.field.model')}
                            value={policy.extraction?.verification?.model}
                            onChange={(value) => setValue(['extraction', 'verification', 'model'], value)}
                            readonly={readonly}
                        />
                        <InputField
                            label={t('intakePolicy.field.environment')}
                            value={policy.extraction?.verification?.environment}
                            onChange={(value) => setValue(['extraction', 'verification', 'environment'], value)}
                            readonly={readonly}
                        />
                        <NumberField
                            label={t('intakePolicy.field.threshold')}
                            value={policy.extraction?.verification?.threshold}
                            min={0}
                            max={1}
                            step={0.05}
                            onChange={(value) => setValue(['extraction', 'verification', 'threshold'], value)}
                            readonly={readonly}
                        />
                        <NumberField
                            label={t('intakePolicy.field.maxRetries')}
                            value={policy.extraction?.verification?.max_retries}
                            min={0}
                            onChange={(value) => setValue(['extraction', 'verification', 'max_retries'], value)}
                            readonly={readonly}
                        />
                        <SelectField
                            label={t('intakePolicy.field.onFailure')}
                            value={policy.extraction?.verification?.on_fail}
                            options={options(t, ['flag', 'block'])}
                            onChange={(value) => setValue(['extraction', 'verification', 'on_fail'], value)}
                            readonly={readonly}
                        />
                    </div>
                    <TextAreaField
                        label={t('intakePolicy.field.materiality')}
                        value={policy.extraction?.verification?.materiality}
                        onChange={(value) => setValue(['extraction', 'verification', 'materiality'], value)}
                        readonly={readonly}
                    />
                </FormSection>
            </FormSurface>
        );
    }

    if (section === 'grounding') {
        const grounding = policy.extraction?.grounding;
        const review = grounding?.review;
        return (
            <FormSurface>
                <FormSection title={t('intakePolicy.section.grounding')}>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <TriStateField
                            label={t('intakePolicy.field.enabled')}
                            value={grounding?.enabled}
                            onChange={(value) => setValue(['extraction', 'grounding', 'enabled'], value)}
                            readonly={readonly}
                        />
                        <NumberField
                            label={t('intakePolicy.field.maxPages')}
                            value={grounding?.max_pages}
                            min={1}
                            onChange={(value) => setValue(['extraction', 'grounding', 'max_pages'], value)}
                            readonly={readonly}
                        />
                        <NumberField
                            label={t('intakePolicy.field.windowPages')}
                            value={grounding?.window_pages}
                            min={1}
                            onChange={(value) => setValue(['extraction', 'grounding', 'window_pages'], value)}
                            readonly={readonly}
                        />
                        <InputField
                            label={t('intakePolicy.field.interaction')}
                            value={grounding?.interaction}
                            onChange={(value) => setValue(['extraction', 'grounding', 'interaction'], value)}
                            readonly={readonly}
                        />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <TriStateField
                            label={t('intakePolicy.field.useVision')}
                            value={grounding?.use_vision}
                            onChange={(value) => setValue(['extraction', 'grounding', 'use_vision'], value)}
                            readonly={readonly}
                        />
                        <TriStateField
                            label={t('intakePolicy.field.forceOcr')}
                            value={grounding?.force_ocr}
                            onChange={(value) => setValue(['extraction', 'grounding', 'force_ocr'], value)}
                            readonly={readonly}
                        />
                        <TriStateField
                            label={t('intakePolicy.field.refreshOcr')}
                            value={grounding?.refresh_ocr}
                            onChange={(value) => setValue(['extraction', 'grounding', 'refresh_ocr'], value)}
                            readonly={readonly}
                        />
                        <TriStateField
                            label={t('intakePolicy.field.omitBlockBoxes')}
                            value={grounding?.omit_block_boxes}
                            onChange={(value) => setValue(['extraction', 'grounding', 'omit_block_boxes'], value)}
                            readonly={readonly}
                        />
                        <TriStateField
                            label={t('intakePolicy.field.updateProperties')}
                            value={grounding?.update_properties}
                            onChange={(value) => setValue(['extraction', 'grounding', 'update_properties'], value)}
                            readonly={readonly}
                        />
                    </div>
                </FormSection>

                <FormSection title={t('intakePolicy.section.models')}>
                    <ModelConfigFields
                        title={t('intakePolicy.field.primaryModel')}
                        config={grounding?.config}
                        onChange={(value) => setValue(['extraction', 'grounding', 'config'], value)}
                        readonly={readonly}
                    />
                    <ModelConfigFields
                        title={t('intakePolicy.field.hardModel')}
                        config={grounding?.hard_config}
                        onChange={(value) => setValue(['extraction', 'grounding', 'hard_config'], value)}
                        readonly={readonly}
                    />
                    <div className="grid gap-4 md:grid-cols-2">
                        <NumberField
                            label={t('intakePolicy.field.hardnessThreshold')}
                            value={grounding?.hardness_threshold}
                            min={0}
                            max={1}
                            step={0.05}
                            onChange={(value) => setValue(['extraction', 'grounding', 'hardness_threshold'], value)}
                            readonly={readonly}
                        />
                        <NumberField
                            label={t('intakePolicy.field.minCitationDensity')}
                            value={grounding?.min_citation_density}
                            min={0}
                            max={1}
                            step={0.05}
                            onChange={(value) => setValue(['extraction', 'grounding', 'min_citation_density'], value)}
                            readonly={readonly}
                        />
                    </div>
                </FormSection>

                <FormSection title={t('intakePolicy.section.review')} last>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <TriStateField
                            label={t('intakePolicy.field.enabled')}
                            value={review?.enabled}
                            onChange={(value) => setValue(['extraction', 'grounding', 'review', 'enabled'], value)}
                            readonly={readonly}
                        />
                        <TriStateField
                            label={t('intakePolicy.field.forceReview')}
                            value={review?.force}
                            onChange={(value) => setValue(['extraction', 'grounding', 'review', 'force'], value)}
                            readonly={readonly}
                        />
                        <NumberField
                            label={t('intakePolicy.field.reviewThreshold')}
                            value={review?.threshold}
                            min={0}
                            max={1}
                            step={0.05}
                            onChange={(value) => setValue(['extraction', 'grounding', 'review', 'threshold'], value)}
                            readonly={readonly}
                        />
                        <NumberField
                            label={t('intakePolicy.field.coverageThreshold')}
                            value={review?.coverage_threshold}
                            min={0}
                            max={1}
                            step={0.05}
                            onChange={(value) =>
                                setValue(['extraction', 'grounding', 'review', 'coverage_threshold'], value)
                            }
                            readonly={readonly}
                        />
                    </div>
                    <ModelConfigFields
                        title={t('intakePolicy.field.reviewModel')}
                        config={review?.config}
                        onChange={(value) => setValue(['extraction', 'grounding', 'review', 'config'], value)}
                        readonly={readonly}
                    />
                </FormSection>
            </FormSurface>
        );
    }

    return (
        <FormSurface>
            <FormSection title={t('intakePolicy.section.rendering')}>
                <TextAreaField
                    label={t('intakePolicy.field.renderingTemplate')}
                    description={t('intakePolicy.help.renderingTemplate')}
                    value={policy.rendering_template}
                    onChange={(value) => setValue(['rendering_template'], value)}
                    readonly={readonly}
                    monospace
                    minLines={8}
                />
            </FormSection>
            <FormSection title={t('intakePolicy.section.embeddings')} last>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <TriStateField
                        label={t('intakePolicy.field.textEmbedding')}
                        value={policy.embeddings?.text}
                        onChange={(value) => setValue(['embeddings', 'text'], value)}
                        readonly={readonly}
                    />
                    <TriStateField
                        label={t('intakePolicy.field.imageEmbedding')}
                        value={policy.embeddings?.image}
                        onChange={(value) => setValue(['embeddings', 'image'], value)}
                        readonly={readonly}
                    />
                    <TriStateField
                        label={t('intakePolicy.field.propertiesEmbedding')}
                        value={policy.embeddings?.properties}
                        onChange={(value) => setValue(['embeddings', 'properties'], value)}
                        readonly={readonly}
                    />
                    <TriStateField
                        label={t('intakePolicy.field.generateToc')}
                        value={policy.generate_toc}
                        onChange={(value) => setValue(['generate_toc'], value)}
                        readonly={readonly}
                    />
                </div>
            </FormSection>
        </FormSurface>
    );
}

function FormSurface({ children }: { children: ReactNode }) {
    return <div className="mx-auto w-full max-w-6xl px-1 py-4">{children}</div>;
}

function FormSection({ title, children, last = false }: { title: string; children: ReactNode; last?: boolean }) {
    return (
        <section className={last ? 'pb-3' : 'mb-6 border-b pb-6'}>
            <h3 className="mb-4 text-sm font-semibold">{title}</h3>
            <div className="space-y-4">{children}</div>
        </section>
    );
}

function InputField({
    label,
    value,
    onChange,
    readonly,
    description,
}: {
    label: string;
    value?: string;
    onChange: (value: string | undefined) => void;
    readonly: boolean;
    description?: string;
}) {
    return (
        <FormItem label={label} description={description}>
            <Input value={value ?? ''} onChange={(value) => onChange(value || undefined)} disabled={readonly} />
        </FormItem>
    );
}

function TextAreaField({
    label,
    value,
    onChange,
    readonly,
    description,
    minLines = 3,
    monospace = false,
}: {
    label: string;
    value?: string;
    onChange: (value: string | undefined) => void;
    readonly: boolean;
    description?: string;
    minLines?: number;
    monospace?: boolean;
}) {
    return (
        <FormItem label={label} description={description}>
            <Textarea
                value={value ?? ''}
                onChange={(event) => onChange(event.target.value || undefined)}
                disabled={readonly}
                minLines={minLines}
                maxLines={14}
                className={monospace ? 'font-mono' : undefined}
            />
        </FormItem>
    );
}

function NumberField({
    label,
    value,
    onChange,
    readonly,
    min,
    max,
    step,
}: {
    label: string;
    value?: number;
    onChange: (value: number | undefined) => void;
    readonly: boolean;
    min?: number;
    max?: number;
    step?: number;
}) {
    return (
        <FormItem label={label}>
            <NumberInput
                value={value}
                onChange={(value) => onChange(value === undefined || Number.isFinite(value) ? value : undefined)}
                disabled={readonly}
                min={min}
                max={max}
                step={step ?? 1}
                noScroll
            />
        </FormItem>
    );
}

function SelectField<T extends string | number>({
    label,
    description,
    value,
    options,
    onChange,
    readonly,
}: {
    label: string;
    description?: string;
    value?: T;
    options: SelectOption<T>[];
    onChange: (value: T | undefined) => void;
    readonly: boolean;
}) {
    const { t } = useUITranslation();
    const choices: SelectOption<T | '__inherit__'>[] = [
        { value: '__inherit__', label: t('intakePolicy.option.inherit') },
        ...options,
    ];
    const selected = choices.find((option) => option.value === value) ?? choices[0];
    return (
        <FormItem label={label} description={description}>
            <SelectBox
                options={choices}
                value={selected}
                by="value"
                optionLabel={(option) => option.label}
                onChange={(option) => onChange(option.value === '__inherit__' ? undefined : option.value)}
                disabled={readonly}
            />
        </FormItem>
    );
}

function TriStateField({
    label,
    value,
    onChange,
    readonly,
}: {
    label: string;
    value?: boolean;
    onChange: (value: boolean | undefined) => void;
    readonly: boolean;
}) {
    const { t } = useUITranslation();
    const choices = [
        { value: 'inherit', label: t('intakePolicy.option.inherit') },
        { value: 'enabled', label: t('intakePolicy.option.enabled') },
        { value: 'disabled', label: t('intakePolicy.option.disabled') },
    ] as const;
    const selectedValue = value === undefined ? 'inherit' : value ? 'enabled' : 'disabled';
    return (
        <FormItem label={label}>
            <SelectBox
                options={[...choices]}
                value={choices.find((option) => option.value === selectedValue)}
                by="value"
                optionLabel={(option) => option.label}
                onChange={(option) => onChange(option.value === 'inherit' ? undefined : option.value === 'enabled')}
                disabled={readonly}
            />
        </FormItem>
    );
}

function VisionDetailsField({
    value,
    onChange,
    readonly,
}: {
    value?: IntakeVisionDetail[];
    onChange: (value: IntakeVisionDetail[] | undefined) => void;
    readonly: boolean;
}) {
    const { t } = useUITranslation();
    const choices = options(t, ['low', 'standard', 'high'] as const);
    return (
        <FormItem label={t('intakePolicy.field.allowedDetails')}>
            <SelectBox<SelectOption<IntakeVisionDetail>>
                multiple
                options={choices}
                value={choices.filter((option) => value?.includes(option.value))}
                by="value"
                optionLabel={(option) => option.label}
                onChange={(selected) => onChange(selected.length ? selected.map((option) => option.value) : undefined)}
                disabled={readonly}
            />
        </FormItem>
    );
}

function PageRangesField({
    value,
    onChange,
    readonly,
}: {
    value?: IntakePageRanges;
    onChange: (value: IntakePageRanges | undefined) => void;
    readonly: boolean;
}) {
    const { t } = useUITranslation();
    const remove = (index: number) => {
        const next = value?.filter((_, rangeIndex) => rangeIndex !== index);
        onChange(next?.length ? next : undefined);
    };
    return (
        <FormItem label={t('intakePolicy.field.pageRanges')} description={t('intakePolicy.help.pageRanges')}>
            <div className="space-y-2">
                {value?.map((range, index) => (
                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.25rem] gap-2" key={`${index}`}>
                        <NumberInput
                            aria-label={t('intakePolicy.field.rangeStart')}
                            value={range[0]}
                            onChange={(next) => {
                                if (next !== undefined && Number.isFinite(next)) {
                                    onChange(replaceIntakeRange(value, index, 0, next));
                                }
                            }}
                            disabled={readonly}
                            step={1}
                            noScroll
                        />
                        <NumberInput
                            aria-label={t('intakePolicy.field.rangeEnd')}
                            value={range[1]}
                            onChange={(next) => {
                                if (next !== undefined && Number.isFinite(next)) {
                                    onChange(replaceIntakeRange(value, index, 1, next));
                                }
                            }}
                            disabled={readonly}
                            step={1}
                            noScroll
                        />
                        <VTooltip description={t('intakePolicy.action.removeRange')}>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={t('intakePolicy.action.removeRange')}
                                onClick={() => remove(index)}
                                disabled={readonly}
                            >
                                <Trash2 className="size-4" />
                            </Button>
                        </VTooltip>
                    </div>
                ))}
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onChange([...(value ?? []), [1, 1]])}
                    disabled={readonly}
                >
                    <Plus className="size-4" />
                    {t('intakePolicy.action.addRange')}
                </Button>
            </div>
        </FormItem>
    );
}

function ModelConfigFields({
    title,
    config,
    onChange,
    readonly,
}: {
    title: string;
    config?: InteractionExecutionConfiguration;
    onChange: (value: InteractionExecutionConfiguration | undefined) => void;
    readonly: boolean;
}) {
    const { t } = useUITranslation();

    return (
        <div>
            <div className="mb-2 text-xs font-medium text-muted">{title}</div>
            <div className="grid gap-4 md:grid-cols-2">
                <FormItem label={t('intakePolicy.field.environment')}>
                    <SelectEnvironment
                        selectedEnvId={config?.environment}
                        onChange={(environment) => onChange(updateExecutionEnvironment(config, environment?.id))}
                        isClearable
                        disabled={readonly}
                    />
                </FormItem>
                <FormItem label={t('intakePolicy.field.model')}>
                    <SelectModel
                        envId={config?.environment}
                        selectedModelId={config?.model}
                        onChange={(model) => onChange(updateExecutionModel(config, model?.id))}
                        isClearable
                        disabled={readonly || !config?.environment}
                    />
                </FormItem>
            </div>
        </div>
    );
}

function options<T extends string>(
    t: (key: string, values?: Record<string, unknown>) => string,
    values: readonly T[],
): SelectOption<T>[] {
    return values.map((value) => ({ value, label: t(`intakePolicy.option.${value}`) }));
}
