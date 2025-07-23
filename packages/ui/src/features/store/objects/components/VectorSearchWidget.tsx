import { useEffect, useState } from 'react';

import { ProjectConfiguration, VectorSearchQuery, EmbeddingSearchConfig, SupportedEmbeddingTypes } from '@vertesia/common';
import { Button, Input, useToast, Modal, ModalTitle, ModalBody, ModalFooter, Checkbox } from '@vertesia/ui/core';
import { useUserSession } from '@vertesia/ui/session';
import { Settings } from 'lucide-react';

interface VectorSearchWidgetProps {
    onChange: (query?: VectorSearchQuery) => void;
    className?: string;
    status?: boolean;
    isLoading?: boolean;
    refresh: number;
    embeddingTypes?: SupportedEmbeddingTypes[];
}

const allTypes = Object.values(SupportedEmbeddingTypes);

export function VectorSearchWidget({ onChange, isLoading, refresh, embeddingTypes }: VectorSearchWidgetProps) {
    const { client, project } = useUserSession();
    const toast = useToast();

    const [searchText, setSearchText] = useState<string | undefined>(undefined);
    const [config, setConfig] = useState<ProjectConfiguration | undefined>(undefined);
    const isReady = !!project && (!!config?.embeddings.text || !!config?.embeddings.image);
    const [status, setStatus] = useState<string | undefined>(undefined);

    const [showSettings, setShowSettings] = useState(false);
    // Default to all types, or use prop if provided
    const [selectedTypes, setSelectedTypes] = useState<SupportedEmbeddingTypes[]>(embeddingTypes || allTypes);
    useEffect(() => {
        if (embeddingTypes) setSelectedTypes(embeddingTypes);
    }, [embeddingTypes]);

    // Always derive embeddingSearchTypes from selectedTypes
    const embeddingSearchTypes: EmbeddingSearchConfig = selectedTypes.reduce((acc, type) => ({ ...acc, [type]: true }), {} as EmbeddingSearchConfig);

    useEffect(() => {
        setSearchText(undefined);
        setStatus(undefined);
    }, [refresh]);

    useEffect(() => {
        if (!project) return;
        client.projects.retrieve(project.id).then((project) => {
            setConfig(project.configuration);
        })
    }, [project]);

    useEffect(() => {
        if (status) {
            toast({ title: status, status: 'success', duration: 2000 });
        }
    }, [status]);

    useEffect(() => {
        if (!searchText || searchText.length === 0) {
            onChange(undefined);
        }
    }, [searchText]);

    const fireSearch = () => {
        if (!isReady || !searchText) return;
        const query: VectorSearchQuery = {
            text: searchText,
            embeddingSearchTypes,
        };
        onChange(query);
        setStatus("Searching...");
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            fireSearch();
        }
    };

    // Modal state for embedding type selection
    const handleCheckboxChange = (type: SupportedEmbeddingTypes) => (checked: boolean) => {
        if (checked) {
            setSelectedTypes(prev => Array.from(new Set([...prev, type])));
        } else {
            setSelectedTypes(prev => prev.filter(t => t !== type));
        }
    };

    return (
        <div className="flex gap-1 items-center w-1/2">
            <Input placeholder="Type what you are looking for, or select a filter" value={searchText} onChange={setSearchText} onKeyDown={handleKeyPress} />
            <Button variant="ghost" onClick={() => setShowSettings(true)} alt="Semantic search settings" className="ml-1"><Settings size={18} /></Button>
            <Modal isOpen={showSettings} onClose={() => setShowSettings(false)}>
                <ModalTitle>Embedding Types</ModalTitle>
                <ModalBody>
                    <div className="flex flex-col gap-2">
                        {allTypes.map(type => (
                            <label key={type} className="flex items-center gap-2">
                                <Checkbox
                                    checked={selectedTypes.includes(type)}
                                    onCheckedChange={handleCheckboxChange(type)}
                                />
                                <span>{type.charAt(0).toUpperCase() + type.slice(1)}</span>
                            </label>
                        ))}
                    </div>
                </ModalBody>
                <ModalFooter>
                    <Button variant="outline" onClick={() => setShowSettings(false)}>Close</Button>
                </ModalFooter>
            </Modal>
            <Button variant="secondary" isLoading={isLoading} onClick={fireSearch} isDisabled={!isReady} alt="Semantic search">Search</Button>
        </div>
    );
}
