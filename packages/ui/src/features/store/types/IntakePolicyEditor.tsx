import { type ContentObjectType, type ContentTypeIntakePolicy, ContentTypeIntakePolicySchema } from '@vertesia/common';
import {
    Badge,
    Button,
    Dropdown,
    errorMessage,
    MenuGroup,
    MenuItem,
    Panel,
    useTheme,
    useToast,
} from '@vertesia/ui/core';
import { useUserSession } from '@vertesia/ui/session';
import { type EditorApi, type Monaco, MonacoEditor } from '@vertesia/ui/widgets';
import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { Braces, CheckCircle2, FileText, RotateCcw, Save, WandSparkles } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

interface IntakePolicyEditorProps {
    objectType: ContentObjectType;
    onIntakeUpdate: (value: ContentTypeIntakePolicy | undefined) => void;
    readonly?: boolean;
}

type IntakeExampleKey =
    | 'minimal'
    | 'extraction_only'
    | 'visual_first'
    | 'structured_spreadsheet'
    | 'media_no_transcript';

interface IntakeExample {
    key: IntakeExampleKey;
    label: string;
    description: string;
    value: ContentTypeIntakePolicy;
}

const INTAKE_EXAMPLES: IntakeExample[] = [
    {
        key: 'minimal',
        label: 'Minimal',
        description: 'Use project defaults and add only type-selection guidance.',
        value: {
            identification: {
                guidance: 'Documents that match this content type.',
                distinguish_from: 'Do not select this type for unrelated documents.',
            },
        },
    },
    {
        key: 'extraction_only',
        label: 'Extraction Only',
        description: 'Extract properties visually, render a compact text summary, and keep the source view.',
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
            rendering_template: '# {{title}}\n\n{{summary}}',
            embeddings: {
                text: true,
                properties: true,
            },
            default_view: 'pdf',
        },
    },
    {
        key: 'visual_first',
        label: 'Visual First',
        description: 'Use visual evidence for PDFs, scans, PowerPoint files, diagrams, and layout-heavy content.',
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
        label: 'Spreadsheet Text',
        description: 'Use structured worksheet text for Excel/CSV files.',
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
        label: 'Media, No Transcript',
        description: 'Disable transcription/conversion while preserving property extraction settings.',
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
];

const EMPTY_POLICY: ContentTypeIntakePolicy = {};

export function IntakePolicyEditor({ objectType, onIntakeUpdate, readonly = false }: IntakePolicyEditorProps) {
    const { store } = useUserSession();
    const toast = useToast();
    const { theme } = useTheme();
    const editorRef = useRef<EditorApi | undefined>(undefined);
    const validatePolicy = useMemo(() => createPolicyValidator(), []);

    const [isUpdating, setUpdating] = useState(false);
    const [editorValue, setEditorValue] = useState(() => stringifyPolicy(objectType.intake));
    const [savedValue, setSavedValue] = useState(() => stringifyPolicy(objectType.intake));
    const [validationMessage, setValidationMessage] = useState<string | undefined>(undefined);

    const isDirty = editorValue !== savedValue;
    const currentPolicy = useMemo(() => parsePolicyOrUndefined(editorValue), [editorValue]);
    const summaryPolicy = currentPolicy ?? objectType.intake ?? EMPTY_POLICY;

    const beforeMount = (monaco: Monaco) => {
        const namespace = monaco as unknown as {
            languages?: { json?: { jsonDefaults?: { setDiagnosticsOptions(options: unknown): void } } };
            json?: { jsonDefaults?: { setDiagnosticsOptions(options: unknown): void } };
        };
        const jsonDefaults = namespace.languages?.json?.jsonDefaults ?? namespace.json?.jsonDefaults;
        jsonDefaults?.setDiagnosticsOptions({
            validate: true,
            allowComments: false,
            schemas: [
                {
                    uri: 'vertesia://schemas/content-type-intake-policy.json',
                    fileMatch: ['*'],
                    schema: ContentTypeIntakePolicySchema,
                },
            ],
        });
    };

    const validateCurrentEditorValue = () => {
        const value = editorRef.current?.getValue() ?? editorValue;
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

        setUpdating(true);
        store.types
            .update(objectType.id, {
                intake: policy,
            })
            .then((response) => {
                const nextValue = stringifyPolicy(response.intake);
                setEditorValue(nextValue);
                setSavedValue(nextValue);
                onIntakeUpdate(response.intake);
                toast({
                    status: 'success',
                    title: 'Intake policy updated',
                    description: 'The type intake policy has been saved.',
                    duration: 2000,
                });
            })
            .catch((err: unknown) => {
                toast({
                    status: 'error',
                    title: 'Failed to update intake policy',
                    description: errorMessage(err),
                    duration: 5000,
                });
            })
            .finally(() => {
                setUpdating(false);
            });
    };

    const onValidate = () => {
        const policy = validateCurrentEditorValue();
        toast({
            status: policy ? 'success' : 'error',
            title: policy ? 'Valid intake policy' : 'Invalid intake policy',
            description: policy ? 'The JSON is valid and matches the intake policy schema.' : validationMessage,
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
    };

    const title = (
        <div className="flex items-center gap-2">
            <div className="text-base font-semibold">Intake Policy</div>
            {isDirty && <Badge variant="attention">Unsaved</Badge>}
        </div>
    );

    const action = !readonly ? (
        <>
            <Dropdown
                align="right"
                trigger={
                    <Button variant="outline" size="sm">
                        <WandSparkles className="size-4" />
                        Examples
                    </Button>
                }
            >
                <MenuGroup label="Insert example">
                    {INTAKE_EXAMPLES.map((example) => (
                        <MenuItem key={example.key} onClick={() => insertExample(example)}>
                            <FileText className="size-4" />
                            <div className="flex flex-col">
                                <span>{example.label}</span>
                                <span className="text-xs text-muted">{example.description}</span>
                            </div>
                        </MenuItem>
                    ))}
                </MenuGroup>
            </Dropdown>
            <Button variant="outline" size="sm" onClick={onFormat}>
                <Braces className="size-4" />
                Format
            </Button>
            <Button variant="outline" size="sm" onClick={onValidate}>
                <CheckCircle2 className="size-4" />
                Validate
            </Button>
            <Button variant="outline" size="sm" onClick={onRevert} disabled={!isDirty}>
                <RotateCcw className="size-4" />
                Revert
            </Button>
            <Button isLoading={isUpdating} size="sm" onClick={onSave} disabled={!isDirty}>
                <Save className="size-4" />
                Save
            </Button>
        </>
    ) : undefined;

    return (
        <Panel title={title} className="bg-background! h-full" action={action}>
            <div className="flex h-full min-h-0 gap-4">
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                    <IntakeSummary policy={summaryPolicy} />
                    {validationMessage && (
                        <div className="rounded-sm border border-destructive bg-mixer-destructive/10 px-3 py-2 text-sm text-destructive">
                            {validationMessage}
                        </div>
                    )}
                    <div className="min-h-0 flex-1 overflow-hidden rounded-sm border">
                        <MonacoEditor
                            value={editorValue}
                            language="json"
                            editorRef={editorRef}
                            beforeMount={beforeMount}
                            onChange={(update) => {
                                setEditorValue(update.state.doc.toString());
                                setValidationMessage(undefined);
                            }}
                            theme={theme === 'dark' ? 'vs-dark' : 'vs'}
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
                </div>
                <IntakeHelp />
            </div>
        </Panel>
    );
}

function IntakeSummary({ policy }: { policy: ContentTypeIntakePolicy }) {
    const values = [
        ['Mode', policy.mode ?? 'inherit'],
        ['Conversion', enabledLabel(policy.text_conversion?.enabled)],
        ['Method', policy.text_conversion?.method ?? 'inherit'],
        ['Source', policy.extraction?.source ?? 'inherit'],
        ['Extraction', enabledLabel(policy.extraction?.enabled)],
        ['Default View', policy.default_view ?? 'inherit'],
        ['TOC', enabledLabel(policy.generate_toc)],
        ['Template', policy.rendering_template ? 'set' : 'inherit'],
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
    return (
        <aside className="hidden w-80 shrink-0 overflow-y-auto rounded-sm border bg-mixer-muted/20 p-3 text-sm lg:block">
            <div className="mb-3 font-semibold">Field Guide</div>
            <div className="space-y-3 text-muted">
                <HelpItem label="identification" text="Guidance for automatic type selection before extraction." />
                <HelpItem
                    label="text_conversion"
                    text="Controls markdown/text generation. Set enabled=false for extraction-only types."
                />
                <HelpItem
                    label="extraction.source"
                    text="auto chooses text or vision. text is text only. vision is image/PDF evidence. mixed sends both."
                />
                <HelpItem
                    label="rendering_template"
                    text="Handlebars template used to materialize extracted properties into object text."
                />
                <HelpItem label="embeddings" text="Optional per-type text/image/properties embedding switches." />
                <HelpItem label="default_view" text="Preferred first view for objects of this type." />
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

function enabledLabel(value: boolean | undefined) {
    if (value === true) return 'enabled';
    if (value === false) return 'disabled';
    return 'inherit';
}

function stringifyPolicy(policy: ContentTypeIntakePolicy | undefined) {
    return JSON.stringify(policy ?? EMPTY_POLICY, null, 2);
}

function parsePolicyOrUndefined(content: string) {
    try {
        return JSON.parse(content) as ContentTypeIntakePolicy;
    } catch {
        return undefined;
    }
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
