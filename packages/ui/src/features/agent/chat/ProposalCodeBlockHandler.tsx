import { useMemo } from 'react';
import {
    CodeBlockErrorBoundary,
    CodeBlockPlaceholder,
    type CodeBlockRendererProps,
    isIncompleteJson,
    useCodeBlockContext,
} from '@vertesia/ui/widgets';
import { AskUserWidget, type AskUserWidgetProps } from './AskUserWidget';

interface ProposalOption {
    id?: string;
    value?: string;
    label?: string;
    description?: string;
}

interface ProposalSpec {
    question?: string;
    title?: string;
    description?: string;
    options?: ProposalOption[];
    allowFreeResponse?: boolean;
    multiple?: boolean;
    variant?: AskUserWidgetProps['variant'];
}

/**
 * Proposal/AskUser code block handler.
 * Lives in features/agent/chat (not widgets/markdown) because it renders the
 * agent-specific AskUserWidget; placing it here breaks the
 * widgets/markdown ↔ features/agent/chat module cycle.
 */
export function ProposalCodeBlockHandler({ code }: CodeBlockRendererProps) {
    const { onProposalSelect, onProposalSubmit } = useCodeBlockContext();

    const incomplete = useMemo(() => isIncompleteJson(code), [code]);

    const widgetProps = useMemo((): AskUserWidgetProps | null => {
        if (incomplete) return null;

        try {
            const raw = code.trim();
            const spec = JSON.parse(raw) as ProposalSpec;

            if (!spec.options || (!spec.question && !spec.title)) {
                return null;
            }

            const props: AskUserWidgetProps = {
                question: spec.question || spec.title || '',
                description: spec.description,
                options: Array.isArray(spec.options)
                    ? spec.options.map((opt) => ({
                        id: opt.id || opt.value || '',
                        label: opt.label || '',
                        description: opt.description,
                    }))
                    : undefined,
                allowFreeResponse: spec.allowFreeResponse ?? spec.multiple,
                variant: spec.variant,
                onSelect: onProposalSelect,
                onSubmit: onProposalSubmit,
            };

            if (!props.question || !props.options?.length) {
                return null;
            }

            return props;
        } catch {
            return null;
        }
    }, [code, onProposalSelect, onProposalSubmit, incomplete]);

    if (incomplete) {
        return (
            <CodeBlockPlaceholder
                type="proposal"
                message="Loading options..."
            />
        );
    }

    if (!widgetProps) {
        return (
            <CodeBlockPlaceholder
                type="proposal"
                error="Invalid proposal specification"
            />
        );
    }

    return (
        <CodeBlockErrorBoundary type="proposal" fallbackCode={code}>
            <AskUserWidget {...widgetProps} />
        </CodeBlockErrorBoundary>
    );
}
