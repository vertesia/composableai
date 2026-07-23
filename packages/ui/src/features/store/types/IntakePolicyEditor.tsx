import { type ContentObjectType, type ContentTypeIntakePolicy, ContentTypeIntakePolicySchema } from '@vertesia/common';
import {
    Badge,
    Button,
    Dropdown,
    errorMessage,
    MenuGroup,
    MenuItem,
    Panel,
    Tabs,
    TabsBar,
    TabsPanel,
    useTheme,
    useToast,
} from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';
import { type EditorApi, type Monaco, MonacoEditor } from '@vertesia/ui/widgets';
import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import type { TFunction } from 'i18next';
import { Braces, CheckCircle2, FileText, RotateCcw, Save, WandSparkles } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { IntakePolicyForm, type IntakePolicyFormSection } from './IntakePolicyForm.js';

interface IntakePolicyEditorProps {
    /** Content type whose intake policy is edited; omit when editing a standalone policy. */
    objectType?: ContentObjectType;
    /** Initial policy value when no objectType is given (e.g. the project default policy). */
    value?: ContentTypeIntakePolicy;
    /** Custom persistence (e.g. save to project configuration). Returns the saved policy.
     *  Defaults to saving the objectType's intake when objectType is provided. */
    onSave?: (policy: ContentTypeIntakePolicy) => Promise<ContentTypeIntakePolicy | undefined>;
    onIntakeUpdate?: (value: ContentTypeIntakePolicy | undefined) => void;
    readonly?: boolean;
}

type IntakeExampleKey =
    | 'minimal'
    | 'extraction_only'
    | 'grounded'
    | 'visual_first'
    | 'structured_spreadsheet'
    | 'media_no_transcript'
    | 'full_reference';

interface IntakeExample {
    key: IntakeExampleKey;
    value: ContentTypeIntakePolicy;
}

const INTAKE_EXAMPLES: IntakeExample[] = [
    {
        key: 'minimal',
        value: {
            identification: {
                guidance: 'Documents that match this content type.',
                distinguish_from: 'Do not select this type for unrelated documents.',
            },
        },
    },
    {
        key: 'extraction_only',
        value: {
            text_conversion: {
                enabled: false,
            },
            extraction: {
                enabled: true,
                source: 'vision',
                instructions:
                    'Extract required fields only. Ignore cover pages, appendices, legal boilerplate, and marketing content.',
            },
            rendering_template: '# {{properties.title}}\n\n{{properties.summary}}',
            embeddings: {
                text: true,
                properties: true,
            },
            default_view: 'pdf',
        },
    },
    {
        key: 'grounded',
        value: {
            extraction: {
                enabled: true,
                grounding: {
                    enabled: true,
                    use_vision: true,
                    // Easy tier: Gemini Flash for clean digital / light scans.
                    config: {
                        model: 'publishers/google/models/gemini-3.5-flash',
                        model_options: {
                            _option_id: 'vertexai-gemini',
                            max_tokens: 32000,
                            thinking_level: 'LOW',
                            temperature: 0,
                        } as unknown as NonNullable<
                            import('@vertesia/common').InteractionExecutionConfiguration['model_options']
                        >,
                    },
                    // Hard tier: Gemini Pro when hardness escalates (handwriting, degraded OCR).
                    hard_config: {
                        model: 'publishers/google/models/gemini-3.1-pro-preview',
                        model_options: {
                            _option_id: 'vertexai-gemini',
                            max_tokens: 32000,
                            thinking_level: 'LOW',
                            temperature: 0,
                        } as unknown as NonNullable<
                            import('@vertesia/common').InteractionExecutionConfiguration['model_options']
                        >,
                    },
                    hardness_threshold: 0.5,
                    min_citation_density: 0.3,
                    window_pages: 3,
                    review: {
                        enabled: true,
                        // Flash + MEDIUM thinking: strong review quality at flash cost.
                        config: {
                            model: 'publishers/google/models/gemini-3.5-flash',
                            model_options: {
                                _option_id: 'vertexai-gemini',
                                thinking_level: 'MEDIUM',
                                max_tokens: 32000,
                                temperature: 0,
                            } as unknown as NonNullable<
                                import('@vertesia/common').InteractionExecutionConfiguration['model_options']
                            >,
                        },
                        coverage_threshold: 0.2,
                    },
                },
            },
            default_view: 'pdf',
        },
    },
    {
        key: 'visual_first',
        value: {
            identification: {
                guidance: 'Presentation decks or visual reports with slides, charts, diagrams, tables, or callouts.',
            },
            text_conversion: {
                enabled: true,
                method: 'auto',
            },
            extraction: {
                enabled: true,
                source: 'auto',
                instructions:
                    'Use visual evidence when layout, charts, diagrams, or slide structure contain material information.',
            },
            default_view: 'pdf',
        },
    },
    {
        key: 'structured_spreadsheet',
        value: {
            text_conversion: {
                enabled: true,
                method: 'auto',
                instructions: 'Preserve sheet names, headers, row labels, totals, and period columns.',
            },
            extraction: {
                enabled: true,
                source: 'text',
                instructions: 'Extract values from worksheet text. Do not infer values from charts.',
            },
            default_view: 'properties',
        },
    },
    {
        key: 'media_no_transcript',
        value: {
            text_conversion: {
                enabled: false,
            },
            extraction: {
                enabled: true,
                source: 'auto',
                instructions: 'Analyze available metadata and source evidence without creating a transcript.',
            },
            default_view: 'properties',
        },
    },
    {
        key: 'full_reference',
        value: {
            mode: 'programmatic',
            identification: {
                guidance:
                    'Supplier invoices: billing documents with an invoice number, line items, ' +
                    'amounts due, tax breakdown, and payment terms.',
                distinguish_from:
                    'Quotes and estimates are offers, not payment requests. Credit notes carry ' +
                    'negative amounts. Receipts confirm a payment already made.',
                examples: [],
            },
            text_conversion: {
                enabled: true,
                method: 'auto',
                instructions: 'Keep the commercial terms and totals. Drop boilerplate and legal footers.',
                output_format: 'markdown',
                custom: {
                    interaction: 'my-project:ConvertSpecialDocument',
                    agent: 'my-project:DocumentConversionAgent',
                },
            },
            extraction: {
                enabled: true,
                source: 'auto',
                instructions:
                    'Extract totals from the summary block, not from line items. ' +
                    'Amounts include currency. Dates use ISO 8601.',
                interaction: 'sys:ExtractInformation',
                verification: {
                    enabled: false,
                    model: 'publishers/anthropic/models/claude-sonnet',
                    environment: 'default',
                    materiality:
                        'Amounts, dates, identifiers, and party names are material. Typos in free text are not.',
                    threshold: 0.85,
                    max_retries: 1,
                    on_fail: 'flag',
                },
                grounding: {
                    enabled: true,
                    interaction: 'sys:ExtractInformationGrounded',
                    max_pages: 20,
                    force_ocr: false,
                    use_vision: true,
                    omit_block_boxes: false,
                    // Easy / hard extraction models
                    config: {
                        model: 'publishers/google/models/gemini-3.5-flash',
                    },
                    hard_config: {
                        model: 'publishers/google/models/gemini-3.1-pro-preview',
                    },
                    hardness_threshold: 0.5,
                    window_pages: 3,
                    update_properties: true,
                    min_citation_density: 0.3,
                    refresh_ocr: false,
                    review: {
                        enabled: true,
                        config: {
                            model: 'publishers/google/models/gemini-3.5-flash',
                        },
                        coverage_threshold: 0.2,
                    },
                },
            },
            rendering_template:
                '# Invoice {{properties.invoice_number}}\n\n' +
                '- Vendor: {{properties.vendor_name}}\n' +
                '- Total: {{properties.currency}} {{properties.total_amount}}\n' +
                '- Due: {{properties.due_date}}',
            embeddings: {
                text: true,
                image: false,
                properties: true,
            },
            generate_toc: false,
            default_view: 'auto',
        },
    },
];

const EMPTY_POLICY: ContentTypeIntakePolicy = {};

export function IntakePolicyEditor({
    objectType,
    value,
    onSave: onSaveProp,
    onIntakeUpdate,
    readonly = false,
}: IntakePolicyEditorProps) {
    const { store } = useUserSession();
    const { t } = useUITranslation();
    const toast = useToast();
    const { theme } = useTheme();
    const editorRef = useRef<EditorApi | undefined>(undefined);
    const validatePolicy = useMemo(() => createPolicyValidator(), []);

    const [isUpdating, setUpdating] = useState(false);
    const initialPolicy = objectType?.intake ?? value;
    const [editorValue, setEditorValue] = useState(() => stringifyPolicy(initialPolicy));
    const [savedValue, setSavedValue] = useState(() => stringifyPolicy(initialPolicy));
    const [validationMessage, setValidationMessage] = useState<string | undefined>(undefined);
    const [activeTab, setActiveTab] = useState<IntakePolicyFormSection | 'json'>('overview');

    const isDirty = editorValue !== savedValue;
    const currentPolicy = useMemo(() => {
        const result = parseAndValidatePolicy(editorValue, validatePolicy);
        return result.ok ? result.policy : undefined;
    }, [editorValue, validatePolicy]);
    const summaryPolicy = currentPolicy ?? initialPolicy ?? EMPTY_POLICY;

    const beforeMount = (monaco: Monaco) => {
        const namespace = monaco as unknown as {
            languages?: { json?: { jsonDefaults?: { setDiagnosticsOptions(options: unknown): void } } };
            json?: { jsonDefaults?: { setDiagnosticsOptions(options: unknown): void } };
        };
        const jsonDefaults = namespace.languages?.json?.jsonDefaults ?? namespace.json?.jsonDefaults;
        // ContentTypeIntakePolicySchema (from @vertesia/common) drives autocomplete,
        // hover docs, and validation. Clone so Monaco cannot mutate the shared export.
        const schema = structuredClone(ContentTypeIntakePolicySchema) as typeof ContentTypeIntakePolicySchema;
        jsonDefaults?.setDiagnosticsOptions({
            validate: true,
            allowComments: false,
            schemas: [
                {
                    uri: 'vertesia://schemas/content-type-intake-policy.json',
                    fileMatch: ['*'],
                    schema,
                },
            ],
        });
    };

    const validateCurrentEditorValue = () => {
        const value = activeTab === 'json' ? (editorRef.current?.getValue() ?? editorValue) : editorValue;
        const result = parseAndValidatePolicy(value, validatePolicy);
        if (!result.ok) {
            setValidationMessage(result.message);
            return undefined;
        }
        setValidationMessage(undefined);
        return result.policy;
    };

    const onSave = () => {
        const policy = validateCurrentEditorValue();
        if (!policy) {
            return;
        }

        const persist =
            onSaveProp ??
            (objectType
                ? (next: ContentTypeIntakePolicy) =>
                      store.types.update(objectType.id, { intake: next }).then((response) => response.intake)
                : undefined);
        if (!persist) {
            return;
        }

        setUpdating(true);
        persist(policy)
            .then((saved) => {
                const nextValue = stringifyPolicy(saved ?? policy);
                setEditorValue(nextValue);
                setSavedValue(nextValue);
                onIntakeUpdate?.(saved ?? policy);
                toast({
                    status: 'success',
                    title: t('intakePolicy.toast.updated'),
                    description: t('intakePolicy.toast.saved'),
                    duration: 2000,
                });
            })
            .catch((err: unknown) => {
                toast({
                    status: 'error',
                    title: t('intakePolicy.toast.updateFailed'),
                    description: errorMessage(err),
                    duration: 5000,
                });
            })
            .finally(() => {
                setUpdating(false);
            });
    };

    const onValidate = () => {
        const value = activeTab === 'json' ? (editorRef.current?.getValue() ?? editorValue) : editorValue;
        const result = parseAndValidatePolicy(value, validatePolicy);
        setValidationMessage(result.ok ? undefined : result.message);
        toast({
            status: result.ok ? 'success' : 'error',
            title: result.ok ? t('intakePolicy.toast.valid') : t('intakePolicy.toast.invalid'),
            description: result.ok ? t('intakePolicy.toast.schemaValid') : result.message,
            duration: 3000,
        });
    };

    const onRevert = () => {
        setEditorValue(savedValue);
        editorRef.current?.setValue(savedValue);
        setValidationMessage(undefined);
    };

    const onFormat = () => {
        const policy = validateCurrentEditorValue();
        if (!policy) {
            return;
        }
        const value = stringifyPolicy(policy);
        setEditorValue(value);
        editorRef.current?.setValue(value);
    };

    const insertExample = (example: IntakeExample) => {
        const value = stringifyPolicy(example.value);
        setEditorValue(value);
        editorRef.current?.setValue(value);
        setValidationMessage(undefined);
        setActiveTab('overview');
    };

    const onFormChange = (policy: ContentTypeIntakePolicy) => {
        setEditorValue(stringifyPolicy(policy));
        setValidationMessage(undefined);
    };

    const onTabChange = (tab: string) => {
        const nextTab = tab as IntakePolicyFormSection | 'json';
        if (nextTab !== 'json' && !currentPolicy) {
            setValidationMessage(t('intakePolicy.error.fixJsonBeforeForm'));
            setActiveTab('json');
            return;
        }
        setActiveTab(nextTab);
    };

    const title = (
        <div className="flex items-center gap-2">
            <div className="text-base font-semibold">{t('intakePolicy.title')}</div>
            {isDirty && <Badge variant="attention">{t('intakePolicy.status.unsaved')}</Badge>}
        </div>
    );

    const action = !readonly ? (
        <>
            <Dropdown
                align="right"
                trigger={
                    <Button variant="outline" size="sm">
                        <WandSparkles className="size-4" />
                        {t('intakePolicy.action.examples')}
                    </Button>
                }
            >
                <MenuGroup label={t('intakePolicy.action.insertExample')}>
                    {INTAKE_EXAMPLES.map((example) => (
                        <MenuItem key={example.key} onClick={() => insertExample(example)}>
                            <FileText className="size-4" />
                            <div className="flex flex-col">
                                <span>{t(`intakePolicy.example.${example.key}.label`)}</span>
                                <span className="text-xs text-muted">
                                    {t(`intakePolicy.example.${example.key}.description`)}
                                </span>
                            </div>
                        </MenuItem>
                    ))}
                </MenuGroup>
            </Dropdown>
            {activeTab === 'json' && (
                <>
                    <Button variant="outline" size="sm" onClick={onFormat}>
                        <Braces className="size-4" />
                        {t('intakePolicy.action.format')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={onValidate}>
                        <CheckCircle2 className="size-4" />
                        {t('intakePolicy.action.validate')}
                    </Button>
                </>
            )}
            <Button variant="outline" size="sm" onClick={onRevert} disabled={!isDirty}>
                <RotateCcw className="size-4" />
                {t('intakePolicy.action.revert')}
            </Button>
            <Button isLoading={isUpdating} size="sm" onClick={onSave} disabled={!isDirty}>
                <Save className="size-4" />
                {t('intakePolicy.action.save')}
            </Button>
        </>
    ) : undefined;

    return (
        <Panel title={title} className="bg-background! h-full" action={action}>
            <div className="flex h-full min-h-0 flex-col gap-3">
                <IntakeSummary policy={summaryPolicy} />
                {validationMessage && (
                    <div className="rounded-sm border border-destructive bg-mixer-destructive/10 px-3 py-2 text-sm whitespace-pre-line text-destructive">
                        {validationMessage}
                    </div>
                )}
                <Tabs
                    tabs={createEditorTabs(t, currentPolicy ?? EMPTY_POLICY, readonly, onFormChange, editorValue, {
                        editorRef,
                        beforeMount,
                        onChange: (value) => {
                            setEditorValue(value);
                            setValidationMessage(undefined);
                        },
                        theme,
                    })}
                    current={activeTab}
                    onTabChange={onTabChange}
                    updateHash={false}
                    responsive
                    fullHeight
                    className="px-0"
                >
                    <TabsBar sticky />
                    <TabsPanel className="min-h-0 flex-1 overflow-auto pt-1" />
                </Tabs>
            </div>
        </Panel>
    );
}

function createEditorTabs(
    t: TFunction,
    policy: ContentTypeIntakePolicy,
    readonly: boolean,
    onChange: (policy: ContentTypeIntakePolicy) => void,
    editorValue: string,
    json: {
        editorRef: { current: EditorApi | undefined };
        beforeMount: (monaco: Monaco) => void;
        onChange: (value: string) => void;
        theme: string;
    },
) {
    const formTab = (name: IntakePolicyFormSection, label: string) => ({
        name,
        label,
        content: <IntakePolicyForm policy={policy} section={name} onChange={onChange} readonly={readonly} />,
    });

    return [
        formTab('overview', t('intakePolicy.tab.overview')),
        formTab('conversion', t('intakePolicy.tab.conversion')),
        formTab('extraction', t('intakePolicy.tab.extraction')),
        formTab('grounding', t('intakePolicy.tab.grounding')),
        formTab('output', t('intakePolicy.tab.output')),
        {
            name: 'json',
            label: t('intakePolicy.tab.json'),
            content: (
                <div className="flex h-full min-h-[36rem] gap-4 py-3">
                    <div className="min-w-0 flex-1 overflow-hidden rounded-sm border">
                        <MonacoEditor
                            value={editorValue}
                            language="json"
                            editorRef={json.editorRef}
                            beforeMount={json.beforeMount}
                            onChange={(update) => json.onChange(update.state.doc.toString())}
                            theme={json.theme === 'dark' ? 'vs-dark' : 'vs'}
                            options={{
                                readOnly: readonly,
                                minimap: { enabled: false },
                                scrollBeyondLastLine: false,
                                wordWrap: 'on',
                                lineNumbers: 'on',
                                automaticLayout: true,
                                formatOnPaste: true,
                                formatOnType: true,
                                tabSize: 2,
                            }}
                        />
                    </div>
                    <IntakeHelp />
                </div>
            ),
        },
    ];
}

function IntakeSummary({ policy }: { policy: ContentTypeIntakePolicy }) {
    const { t } = useUITranslation();
    const grounding = policy.extraction?.grounding;
    const values = [
        [t('intakePolicy.summary.mode'), optionLabel(t, policy.mode)],
        [t('intakePolicy.summary.conversion'), enabledLabel(t, policy.text_conversion?.enabled)],
        [t('intakePolicy.summary.method'), optionLabel(t, policy.text_conversion?.method)],
        [t('intakePolicy.summary.source'), optionLabel(t, policy.extraction?.source)],
        [t('intakePolicy.summary.extraction'), enabledLabel(t, policy.extraction?.enabled)],
        [t('intakePolicy.summary.grounding'), enabledLabel(t, grounding?.enabled)],
        [t('intakePolicy.summary.defaultView'), optionLabel(t, policy.default_view)],
        [t('intakePolicy.summary.toc'), enabledLabel(t, policy.generate_toc)],
        [
            t('intakePolicy.summary.template'),
            policy.rendering_template ? t('intakePolicy.option.set') : t('intakePolicy.option.inherit'),
        ],
    ];

    return (
        <div className="flex flex-wrap gap-2">
            {values.map(([label, value]) => (
                <Badge key={label} variant="outline" className="gap-1">
                    <span className="text-muted">{label}:</span>
                    <span>{value}</span>
                </Badge>
            ))}
        </div>
    );
}

function IntakeHelp() {
    const { t } = useUITranslation();
    return (
        <aside className="hidden w-80 shrink-0 overflow-y-auto rounded-sm border bg-mixer-muted/20 p-3 text-sm lg:block">
            <div className="mb-3 font-semibold">{t('intakePolicy.help.title')}</div>
            <div className="space-y-3 text-muted">
                <HelpItem label="identification" text={t('intakePolicy.help.identification')} />
                <HelpItem label="text_conversion" text={t('intakePolicy.help.textConversion')} />
                <HelpItem label="extraction.source" text={t('intakePolicy.help.extractionSource')} />
                <HelpItem label="extraction.grounding" text={t('intakePolicy.help.grounding')} />
                <HelpItem label="extraction.grounding.review" text={t('intakePolicy.help.review')} />
                <HelpItem label="rendering_template" text={t('intakePolicy.help.renderingTemplate')} />
                <HelpItem label="embeddings" text={t('intakePolicy.help.embeddings')} />
                <HelpItem label="default_view" text={t('intakePolicy.help.defaultView')} />
            </div>
        </aside>
    );
}

function HelpItem({ label, text }: { label: string; text: string }) {
    return (
        <div>
            <div className="font-medium text-foreground">{label}</div>
            <div>{text}</div>
        </div>
    );
}

function enabledLabel(t: TFunction, value: boolean | undefined) {
    if (value === true) return t('intakePolicy.option.enabled');
    if (value === false) return t('intakePolicy.option.disabled');
    return t('intakePolicy.option.inherit');
}

function optionLabel(t: TFunction, value: string | undefined) {
    return value ? t(`intakePolicy.option.${value}`) : t('intakePolicy.option.inherit');
}

function stringifyPolicy(policy: ContentTypeIntakePolicy | undefined) {
    return JSON.stringify(policy ?? EMPTY_POLICY, null, 2);
}

function createPolicyValidator() {
    const ajv = new Ajv({
        strict: false,
        allErrors: true,
    });
    addFormats(ajv);
    return ajv.compile(ContentTypeIntakePolicySchema);
}

function parseAndValidatePolicy(
    content: string,
    validatePolicy: ValidateFunction<ContentTypeIntakePolicy>,
): { ok: true; policy: ContentTypeIntakePolicy } | { ok: false; message: string } {
    let parsed: unknown;
    try {
        parsed = content.trim() ? JSON.parse(content) : {};
    } catch (err: unknown) {
        return { ok: false, message: `Invalid JSON: ${errorMessage(err)}` };
    }

    if (!validatePolicy(parsed)) {
        return { ok: false, message: formatAjvErrors(validatePolicy.errors) };
    }

    return { ok: true, policy: parsed as ContentTypeIntakePolicy };
}

function formatAjvErrors(errors: ErrorObject[] | null | undefined) {
    if (!errors?.length) {
        return 'The intake policy does not match the schema.';
    }
    return errors.map((err) => `${err.instancePath || '/'} ${err.message ?? 'is invalid'}`).join('\n');
}
