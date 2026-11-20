import type { AgentMessage } from '@vertesia/common';
import { Button, Modal, ModalBody, ModalFooter, ModalTitle } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { MonacoEditor } from '@vertesia/ui/widgets';
import { Lock, Pencil } from 'lucide-react';
import type React from 'react';
import { useId, useState } from 'react';
import {
    getToolApprovalEditConfig,
    getToolApprovalEditResponseMetadata,
    type ToolApprovalEditProblem,
    validateToolApprovalEdit,
} from './ModernAgentOutput/requestInputMessages';

export interface ToolApprovalEditActionProps {
    /** The tool approval prompt. Nothing renders unless it offers "Edit and run" (`tool_approval.supports_edit`). */
    message: AgentMessage;
    /** Sends the answer: the text shown in the transcript, and the metadata carrying the edited arguments. */
    onSend?: (text: string, metadata: Record<string, unknown>) => void;
    disabled?: boolean;
}

/**
 * "Edit and run" on a tool approval prompt: the reviewer edits the call's arguments, and the edited call runs once.
 * Redacted values arrive as placeholders and stay locked; the workflow puts the real values back.
 */
export function ToolApprovalEditAction({ message, onSend, disabled }: ToolApprovalEditActionProps) {
    const { t } = useUITranslation();
    const config = getToolApprovalEditConfig(message);
    const [isOpen, setIsOpen] = useState(false);
    // The editor is seeded once per opening; `text` follows the edits.
    const [initialText, setInitialText] = useState('');
    const [text, setText] = useState('');
    const [problem, setProblem] = useState<ToolApprovalEditProblem | undefined>();
    const errorId = useId();

    if (!config || !onSend) return null;

    const open = () => {
        const seeded = JSON.stringify(config.input, null, 2);
        setInitialText(seeded);
        setText(seeded);
        setProblem(undefined);
        setIsOpen(true);
    };

    const submit = () => {
        const checked = validateToolApprovalEdit(config, text);
        if ('problem' in checked) {
            setProblem(checked.problem);
            return;
        }
        const metadata = getToolApprovalEditResponseMetadata(message, checked.input);
        if (!metadata) return;
        setIsOpen(false);
        onSend(t('agent.toolApprovalEdit.response'), metadata);
    };

    const problemText = problem ? describeProblem(problem, t) : undefined;

    return (
        <>
            <Button
                variant="outline"
                size="sm"
                onClick={open}
                disabled={disabled}
                className="inline-flex items-center gap-2 self-start"
            >
                <Pencil className="size-4" aria-hidden="true" />
                {t('agent.toolApprovalEdit.action')}
            </Button>
            <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} size="lg" disableCloseOnClickOutside>
                <ModalTitle>{t('agent.toolApprovalEdit.title')}</ModalTitle>
                <ModalBody>
                    <div className="flex flex-col gap-3">
                        <p className="text-sm text-muted">{t('agent.toolApprovalEdit.description')}</p>
                        {config.redactedPaths.length > 0 && (
                            <p className="flex items-start gap-2 text-sm text-attention">
                                <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                                <span>
                                    {t('agent.toolApprovalEdit.lockedFields', {
                                        fields: config.redactedPaths.join(', '),
                                    })}
                                </span>
                            </p>
                        )}
                        <fieldset
                            className="m-0 h-80 min-w-0 overflow-hidden rounded-md border border-border p-0"
                            aria-label={t('agent.toolApprovalEdit.editorLabel')}
                            aria-describedby={problemText ? errorId : undefined}
                        >
                            <MonacoEditor
                                value={initialText}
                                language="json"
                                onChange={(update) => {
                                    if (!update.docChanged) return;
                                    setText(update.state.doc.toString());
                                    setProblem(undefined);
                                }}
                                options={{ minimap: { enabled: false }, scrollBeyondLastLine: false }}
                            />
                        </fieldset>
                        {problemText && (
                            <p id={errorId} role="alert" className="text-sm text-destructive">
                                {problemText}
                            </p>
                        )}
                    </div>
                </ModalBody>
                <ModalFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>
                        {t('modal.cancel')}
                    </Button>
                    <Button onClick={submit} disabled={disabled}>
                        {t('agent.toolApprovalEdit.submit')}
                    </Button>
                </ModalFooter>
            </Modal>
        </>
    );
}

function describeProblem(problem: ToolApprovalEditProblem, t: ReturnType<typeof useUITranslation>['t']): string {
    switch (problem.code) {
        case 'invalid_json':
            return t('agent.toolApprovalEdit.errorInvalidJson');
        case 'not_object':
            return t('agent.toolApprovalEdit.errorNotObject');
        case 'locked_array_changed':
            return t('agent.toolApprovalEdit.errorLockedArray', { path: problem.path });
        case 'redacted_changed':
            return t('agent.toolApprovalEdit.errorRedactedChanged', { path: problem.path });
        case 'secret_added':
            return t('agent.toolApprovalEdit.errorSecretAdded', { path: problem.path });
        case 'placeholder_added':
            return t('agent.toolApprovalEdit.errorPlaceholderAdded', { path: problem.path });
    }
}

/** The "Edit and run" action for `AskUserWidget`'s `extraActions`, or nothing when the prompt does not offer it. */
export function toolApprovalEditActionFor(
    message: AgentMessage,
    onSend: ToolApprovalEditActionProps['onSend'],
    disabled?: boolean,
): React.ReactNode {
    if (!onSend || !getToolApprovalEditConfig(message)) return undefined;
    return <ToolApprovalEditAction message={message} onSend={onSend} disabled={disabled} />;
}
