import { useEffect, useState } from 'react';

import { ProjectConfiguration, ComplexSearchQuery, SupportedEmbeddingTypes, SearchTypes } from '@vertesia/common';
import { Button, Input, useToast, Modal, ModalTitle, ModalBody, ModalFooter, Checkbox, NumberInput } from '@vertesia/ui/core';
import { useUserSession } from '@vertesia/ui/session';
import { Settings } from 'lucide-react';

interface VectorSearchWidgetProps {
    onChange: (query?: ComplexSearchQuery) => void;
    className?: string;
    status?: boolean;
    isLoading?: boolean;
    refresh: number;
    searchTypes?: (keyof typeof SearchTypes)[];
}

const allTypes = Object.values(SearchTypes);
const embeddingTypes = Object.values(SupportedEmbeddingTypes);

export function VectorSearchWidget({ onChange, isLoading, refresh, searchTypes }: VectorSearchWidgetProps) {
    const { client, project } = useUserSession();
    const toast = useToast();

    const [searchText, setSearchText] = useState<string | undefined>(undefined);
    const [config, setConfig] = useState<ProjectConfiguration | undefined>(undefined);
    const isReady = !!project && (!!config?.embeddings.text || !!config?.embeddings.image);
    const [status, setStatus] = useState<string | undefined>(undefined);

    const [showSettings, setShowSettings] = useState(false);
    // Default to all types, or use prop if provided
    const [selectedTypes, setSelectedTypes] = useState<(keyof typeof SearchTypes)[]>(searchTypes || allTypes);
    const [limit, setLimit] = useState<number>(100);
    useEffect(() => {
        if (searchTypes) setSelectedTypes(searchTypes);
    }, [searchTypes]);

    // Always derive embeddingSearchTypes and full_text from selectedTypes
    const embeddingSearchTypes: Record<string, boolean> = {};
    let fullTextEnabled = false;
    let vectorSearchEnabled = false;
    selectedTypes.forEach(type => {
        if (type === SearchTypes.full_text) {
            fullTextEnabled = true;
        } else {
            vectorSearchEnabled = true;
        }
        if (embeddingTypes.includes(type as SupportedEmbeddingTypes)) {
            embeddingSearchTypes[type] = true;
        }
    });

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
        const query: ComplexSearchQuery = {
            vector: vectorSearchEnabled ? {
                text: searchText,
                config: embeddingSearchTypes,
            } : undefined,
            full_text: fullTextEnabled ? searchText : undefined,
            limit: limit
        };
        onChange(query);
        setStatus("Searching...");
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            fireSearch();
        }
    };

    // Modal state for search type selection
    const handleCheckboxChange = (type: keyof typeof SearchTypes) => (checked: boolean) => {
        if (checked) {
            setSelectedTypes(prev => Array.from(new Set([...prev, type])));
        } else {
            setSelectedTypes(prev => prev.filter(t => t !== type));
        }
    };

    return (
        <div className="flex gap-1 items-center">
            <Input placeholder="Type what you are looking for, or select a filter" value={searchText} onChange={setSearchText} onKeyDown={handleKeyPress} className='min-w-[200px]' />
            <Button variant="ghost" onClick={() => setShowSettings(true)} alt="Semantic search settings" className="ml-1"><Settings size={18} /></Button>
            <Modal isOpen={showSettings} onClose={() => setShowSettings(false)}>
                <ModalTitle>Search Types</ModalTitle>
                <ModalBody>
                    <div className="flex flex-col gap-2">
                        <label className="flex items-center gap-2">
                            <Checkbox
                                checked={selectedTypes.includes(SearchTypes.full_text)}
                                onCheckedChange={handleCheckboxChange(SearchTypes.full_text)}
                            />
                            <span>Full Text</span>
                        </label>
                        <div className="font-semibold mt-2 mb-1">Embeddings</div>
                        {embeddingTypes.map(type => (
                            <label key={type} className="flex items-center gap-2">
                                <Checkbox
                                    checked={selectedTypes.includes(type)}
                                    onCheckedChange={handleCheckboxChange(type)}
                                />
                                <span>{type.charAt(0).toUpperCase() + type.slice(1)}</span>
                            </label>
                        ))}
                        <div className="mt-3">
                            <span className="mr-2">Limit</span>
                            <NumberInput type="number" min={1} value={limit} onChange={v => setLimit(Number(v) || 1)} style={{ width: 80 }} />
                        </div>
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
