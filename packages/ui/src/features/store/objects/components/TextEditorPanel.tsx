import type { ContentObject } from '@vertesia/common';
import { Button, errorMessage, useTheme, useToast } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { VertesiaMarkdownDocumentEditor } from '@vertesia/ui/rich-text';
import { useNavigate } from '@vertesia/ui/router';
import { useUserSession } from '@vertesia/ui/session';
import { type IEditorApi, MonacoEditor } from '@vertesia/ui/widgets';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SaveVersionConfirmModal } from './SaveVersionConfirmModal.js';

interface TextEditorPanelProps {
    object: ContentObject;
    text: string;
    onClose: () => void;
    onSaved: () => void;
}

function getMonacoLanguage(contentType?: string): string {
    switch (contentType) {
        case 'text/markdown':
            return 'markdown';
        case 'application/json':
            return 'json';
        case 'application/xml':
        case 'text/xml':
            return 'xml';
        default:
            return 'plaintext';
    }
}

export function TextEditorPanel({ object, text, onClose, onSaved }: TextEditorPanelProps) {
    const { store } = useUserSession();
    const toast = useToast();
    const { t } = useUITranslation();
    const { theme } = useTheme();
    const navigate = useNavigate();
    const editorRef = useRef<IEditorApi | undefined>(undefined);
    const [editorText, setEditorText] = useState(text);
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);

    const language = getMonacoLanguage(object.content?.type);
    const isMarkdown = object.content?.type === 'text/markdown';

    useEffect(() => {
        setEditorText(text);
        setIsDirty(false);
    }, [text]);

    const handleEditorChange = useCallback(() => {
        if (!isDirty) setIsDirty(true);
    }, [isDirty]);

    const handleMarkdownChange = useCallback(
        (markdown: string) => {
            setEditorText(markdown);
            setIsDirty(markdown !== text);
        },
        [text],
    );

    function handleSave() {
        if (!isMarkdown && !editorRef.current) return;
        setShowConfirmation(true);
    }

    async function saveText(createVersion: boolean, versionLabel?: string) {
        if (!isMarkdown && !editorRef.current) return;

        const content = isMarkdown ? editorText : editorRef.current?.getValue();
        if (content === undefined) return;
        const contentType = object.content?.type || 'text/plain';
        const fileName = object.content?.name || 'content.txt';

        try {
            setIsSaving(true);

            const blob = new Blob([content], { type: contentType });
            const file = new File([blob], fileName, { type: contentType });

            const response = await store.objects.update(
                object.id,
                {
                    content: file,
                },
                {
                    createRevision: createVersion,
                    revisionLabel: versionLabel,
                    ifMatch: object.content?.etag,
                },
            );

            toast({
                status: 'success',
                title: t('store.textSaved'),
                duration: 2000,
            });

            setShowConfirmation(false);

            if (createVersion && response.id !== object.id) {
                onClose();
                setTimeout(() => {
                    navigate(`/objects/${response.id}`);
                }, 100);
            } else {
                onSaved();
            }
        } catch (error: unknown) {
            const message = errorMessage(error, t('store.errorSavingTextDefault'));
            const status = typeof error === 'object' && error !== null && 'status' in error ? error.status : undefined;
            const is412 = status === 412 || message.includes('412');
            toast({
                status: 'error',
                title: t('store.errorSavingText'),
                description: is412 ? t('store.textConflict') : message,
                duration: 5000,
            });
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <>
            <div className="flex items-center gap-2 px-2 py-1 shrink-0">
                {isDirty && <span className="text-xs text-attention">{t('store.unsavedChanges')}</span>}
                <div className="flex-1" />
                <Button variant="ghost" size="sm" onClick={onClose} disabled={isSaving}>
                    {t('store.cancelEdit')}
                </Button>
                <Button variant="secondary" size="sm" onClick={handleSave} disabled={!isDirty} isLoading={isSaving}>
                    {t('store.saveText')}
                </Button>
            </div>
            <div className="flex-1 min-h-0 border rounded-md overflow-hidden mx-2 mb-2">
                {isMarkdown ? (
                    <VertesiaMarkdownDocumentEditor value={editorText} onChange={handleMarkdownChange} />
                ) : (
                    <MonacoEditor
                        value={text}
                        language={language}
                        editorRef={editorRef}
                        onChange={handleEditorChange}
                        theme={theme === 'dark' ? 'vs-dark' : 'vs'}
                        options={{
                            wordWrap: 'on',
                            minimap: { enabled: false },
                            lineNumbers: 'on',
                            scrollBeyondLastLine: false,
                        }}
                    />
                )}
            </div>

            <SaveVersionConfirmModal
                isOpen={showConfirmation}
                onClose={() => setShowConfirmation(false)}
                onConfirm={saveText}
                isLoading={isSaving}
            />
        </>
    );
}
