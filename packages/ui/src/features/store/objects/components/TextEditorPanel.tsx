import { useState, useRef, useCallback } from 'react';
import { ContentObject } from '@vertesia/common';
import { Button, useToast, useTheme } from '@vertesia/ui/core';
import { useUserSession } from '@vertesia/ui/session';
import { useNavigate } from '@vertesia/ui/router';
import { MonacoEditor, IEditorApi } from '@vertesia/ui/widgets';
import { useUITranslation } from '../../../../i18n/index.js';
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
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);

    const language = getMonacoLanguage(object.content?.type);

    const handleEditorChange = useCallback(() => {
        if (!isDirty) setIsDirty(true);
    }, [isDirty]);

    function handleSave() {
        if (!editorRef.current) return;
        setShowConfirmation(true);
    }

    async function saveText(createVersion: boolean, versionLabel?: string) {
        if (!editorRef.current) return;

        const editorText = editorRef.current.getValue();
        const contentType = object.content?.type || 'text/plain';
        const fileName = object.content?.name || 'content.txt';

        try {
            setIsSaving(true);

            const blob = new Blob([editorText], { type: contentType });
            const file = new File([blob], fileName, { type: contentType });

            const response = await store.objects.update(object.id, {
                content: file as any,
            }, {
                createRevision: createVersion,
                revisionLabel: versionLabel,
                ifMatch: object.content?.etag,
            });

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
        } catch (error: any) {
            const is412 = error?.status === 412 || error?.message?.includes('412');
            toast({
                status: 'error',
                title: t('store.errorSavingText'),
                description: is412
                    ? t('store.textConflict')
                    : (error.message || t('store.errorSavingTextDefault')),
                duration: 5000,
            });
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <>
            <div className="flex items-center gap-2 px-2 py-1 shrink-0">
                {isDirty && (
                    <span className="text-xs text-attention">{t('store.unsavedChanges')}</span>
                )}
                <div className="flex-1" />
                <Button variant="secondary" size="sm" onClick={onClose} disabled={isSaving}>
                    {t('store.cancelEdit')}
                </Button>
                <Button variant="primary" size="sm" onClick={handleSave} disabled={!isDirty} isLoading={isSaving}>
                    {t('store.saveText')}
                </Button>
            </div>
            <div className="flex-1 min-h-0 border rounded-md overflow-hidden mx-2 mb-2">
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
