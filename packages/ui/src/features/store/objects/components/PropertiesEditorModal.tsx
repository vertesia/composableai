import { useUserSession } from '@vertesia/ui/session';
import { useState, useRef, useEffect } from 'react';
import {
    Button,
    Modal,
    ModalBody,
    ModalFooter,
    ModalTitle,
    useToast
} from '@vertesia/ui/core';
import { ContentObject } from '@vertesia/common';
import { useNavigate } from "@vertesia/ui/router";

// Import Monaco Editor
import Editor, { Monaco } from '@monaco-editor/react';
import { editor } from 'monaco-editor';

// Import SaveVersionConfirmModal
import { SaveVersionConfirmModal } from './SaveVersionConfirmModal';

export interface PropertiesEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    object: ContentObject;
}

export function PropertiesEditorModal({ isOpen, onClose, object }: PropertiesEditorModalProps) {
    const { client, store } = useUserSession();
    const toast = useToast();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [propertiesJson, setPropertiesJson] = useState('');
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [parsedProperties, setParsedProperties] = useState<any>(null);
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
    const monacoRef = useRef<Monaco | null>(null);
    const [jsonSchema, setJsonSchema] = useState<any>(null);
    //TODO  state not used
    const [_newVersionId, setNewVersionId] = useState<string | null>(null);

    // Initialize editor content when modal opens
    useEffect(() => {
        if (isOpen) {
            setPropertiesJson(JSON.stringify(object.properties || {}, null, 2));

            // Try to fetch JSON schema if object has a type
            if (object.type?.id) {
                fetchJsonSchema(object.type.id);
            }
        }
    }, [isOpen, object]);

    // Handle editor mounting
    function handleEditorDidMount(editor: editor.IStandaloneCodeEditor, monaco: Monaco) {
        editorRef.current = editor;
        monacoRef.current = monaco;

        // Apply JSON schema validation if available
        if (jsonSchema) {
            setMonacoJsonSchema(monaco, jsonSchema);
        }
    }

    // Fetch JSON schema for the object type
    async function fetchJsonSchema(typeId: string) {
        try {
            const typeDetails = await store.types.retrieve(typeId);
            if (typeDetails.object_schema) {
                setJsonSchema(typeDetails.object_schema);

                // Apply schema if Monaco is already mounted
                if (monacoRef.current) {
                    setMonacoJsonSchema(monacoRef.current, typeDetails.object_schema);
                }
            }
        } catch (error) {
            console.error('Failed to fetch JSON schema:', error);
        }
    }

    // Configure Monaco editor with JSON schema
    function setMonacoJsonSchema(monaco: Monaco, schema: any) {
        monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
            validate: true,
            schemas: [
                {
                    uri: 'http://myserver/object-schema.json',
                    fileMatch: ['*'],
                    schema
                }
            ]
        });
    }

    // Validate JSON and open confirmation modal
    function handleSave() {
        if (!editorRef.current) return;

        const editorValue = editorRef.current.getValue();

        try {
            const properties = JSON.parse(editorValue);
            setParsedProperties(properties);
            setShowConfirmation(true);
        } catch (err) {
            toast({
                status: 'error',
                title: 'Invalid JSON',
                description: 'Please fix the JSON syntax errors before saving.',
                duration: 5000
            });
        }
    }

    // Save properties
    async function saveProperties(createVersion: boolean, versionLabel?: string) {
        try {
            setIsLoading(true);

            const properties = parsedProperties || JSON.parse(propertiesJson);

            if (createVersion) {
                // Create a new version with the updated properties
                const response = await client.objects.update(object.id, {
                    properties: properties
                }, {
                    createRevision: true,
                    revisionLabel: versionLabel
                });

                // Store the new version ID for navigation
                if (response.id !== object.id) {
                    setNewVersionId(response.id);
                }

                toast({
                    status: 'success',
                    title: 'New version created',
                    description: 'A new version with updated properties has been created.',
                    duration: 2000
                });

                // Close modals
                setShowConfirmation(false);
                onClose();

                // Navigate to the new version
                if (response.id !== object.id) {
                    // Delay slightly to allow modal closing to complete
                    setTimeout(() => {
                        navigate(`/objects/${response.id}`);
                        toast({
                            status: 'info',
                            title: 'Viewing New Version',
                            description: versionLabel ? `Now viewing version '${versionLabel}'` : 'Now viewing the new version',
                            duration: 3000
                        });
                    }, 100);
                }
            } else {
                // Update the object properties in place
                await store.objects.update(object.id, {
                    properties: properties
                });

                toast({
                    status: 'success',
                    title: 'Properties updated',
                    description: 'The object properties have been updated successfully.',
                    duration: 2000
                });

                // Close modals
                setShowConfirmation(false);
                onClose();
            }
        } catch (error: any) {
            toast({
                status: 'error',
                title: 'Error updating properties',
                description: error.message || 'An error occurred while updating the properties.',
                duration: 5000
            });
            setIsLoading(false);
        }
    }

    // Handle closing the confirmation modal without saving
    function handleCancelConfirmation() {
        setShowConfirmation(false);
    }


    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                className="sm:max-w-[90%] md:max-w-[80%] lg:max-w-[75%] xl:max-w-[70%]"
            >
                <ModalTitle>Edit Properties</ModalTitle>
                <ModalBody>
                    <div className="mb-2 text-sm text-gray-500">
                        {object.type?.name ? (
                            <span>Editing properties for object type: <strong>{object.type.name}</strong></span>
                        ) : (
                            <span>Editing properties for generic document</span>
                        )}
                        {jsonSchema && (
                            <span className="ml-2 text-green-600">(JSON schema validation enabled)</span>
                        )}
                    </div>
                    <div className="h-[75vh] border border-gray-300 dark:border-gray-700 rounded-md">
                        <Editor
                            height="100%"
                            language="json"
                            value={propertiesJson}
                            onChange={(value) => setPropertiesJson(value || '')}
                            onMount={handleEditorDidMount}
                            options={{
                                minimap: { enabled: false },
                                scrollBeyondLastLine: false,
                                formatOnPaste: true,
                                formatOnType: true,
                                automaticLayout: true,
                                wordWrap: 'on'
                            }}
                        />
                    </div>
                </ModalBody>
                <ModalFooter>
                    <Button variant="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSave}
                    >
                        Save Changes
                    </Button>
                </ModalFooter>
            </Modal>

            {/* Version Confirmation Modal */}
            <SaveVersionConfirmModal
                isOpen={showConfirmation}
                onClose={handleCancelConfirmation}
                onConfirm={saveProperties}
                isLoading={isLoading}
            />
        </>
    );
}