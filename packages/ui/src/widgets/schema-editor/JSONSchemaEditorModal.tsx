import { json } from "@codemirror/lang-json";
import { CodeMirrorEditor, EditorApi } from "../codemirror";
import { Button, VModal, VModalBody, VModalFooter, VModalTitle, useToast } from "@vertesia/ui/core";
import { basicSetup } from "codemirror";
import { useMemo, useRef } from "react";
import { ManagedSchema } from "./ManagedSchema.js";
import { JSONCode } from '../json-view';

function contentToJSON(content: string | undefined | null) {
    if (!content) return undefined;
    content = content.trim();
    if (!content) return undefined;
    return JSON.parse(content);
}

function jsonToContent(json: any | undefined | null) {
    if (!json) return '';
    return JSON.stringify(json, null, 2);
}

const extensions = [basicSetup, json()]

interface JSONSchemaEditorModalProps {
    schema: ManagedSchema;
    isOpen?: boolean;
    onClose: () => void;
    readonly?: boolean;
}
export function JSONSchemaEditorModal({ schema, isOpen, onClose, readonly = false }: JSONSchemaEditorModalProps) {
    const editorRef = useRef<EditorApi | undefined>(undefined);
    const toast = useToast();

    const value = useMemo(() => {
        return jsonToContent(schema.schema);
    }, [schema])

    const onSaveChanges = () => {
        if (editorRef.current) {
            const value = editorRef.current.getValue();
            try {
                const newSchema = contentToJSON(value);
                schema.replaceSchema(newSchema);
                onClose();
            } catch (err: any) {
                toast({
                    status: 'error',
                    title: 'Invalid JSON Schema',
                    description: err.message,
                    duration: 5000
                })
            }
        }
    }

    return (
        <VModal onClose={onClose} isOpen={!!isOpen} className='min-w-[60vw]'>
            <VModalTitle>JSON Schema Editor</VModalTitle>
            <VModalBody>
                {!readonly ? <CodeMirrorEditor value={value} extensions={extensions} editorRef={editorRef} />
                    : <JSONCode data={schema.schema || {}} />}
            </VModalBody>
            <VModalFooter>
                {!readonly ? <Button onClick={onSaveChanges}>Save changes</Button> : null}
            </VModalFooter>
        </VModal>
    )
}
