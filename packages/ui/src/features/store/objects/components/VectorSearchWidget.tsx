import { useEffect, useState } from 'react';

import { ProjectConfiguration, SupportedEmbeddingTypes, VectorSearchQuery } from '@vertesia/common';
import { Button, Input, useToast } from '@vertesia/ui/core';
import { useUserSession } from '@vertesia/ui/session';

interface VectorSearchWidgetProps {
    onChange: (query?: VectorSearchQuery) => void;
    className?: string;
    status?: boolean;
    isLoading?: boolean;
    refresh: number
}
export function VectorSearchWidget({ onChange, isLoading, refresh }: VectorSearchWidgetProps) {
    const { client, project } = useUserSession();
    const toast = useToast();

    const [searchText, setSearchText] = useState<string | undefined>(undefined);
    const [searchSketch, setSearchSketch] = useState<string | undefined>(undefined);
    const [config, setConfig] = useState<ProjectConfiguration | undefined>(undefined);
    const isReady = !!project && (!!config?.embeddings.text || !!config?.embeddings.image);
    const [status, setStatus] = useState<string | undefined>(undefined);

    useEffect(() => {
        setSearchText(undefined);
        setSearchSketch(undefined);
        setStatus(undefined);
    }, [refresh]);

    useEffect(() => {
        if (!project) {
            return;
        }

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

    const generateTextEmbeddings = async () => {
        if (!isReady || !searchText || !config?.embeddings.text) {
            return;
        }

        setStatus('Generating text embeddings...');
        const response = await client.environments.embeddings(config.embeddings.text?.environment, {
            model: config.embeddings.text?.model,
            text: searchText,
        });

        const query: VectorSearchQuery = {
            values: response.values,
            type: SupportedEmbeddingTypes.text
        };

        return query;
    };

    const generateImageEmbeddings = async () => {
        if (!isReady || !searchText || !config?.embeddings.image) {
            return;
        }

        setStatus('Generating image embeddings...');
        const response = await client.environments.embeddings(config.embeddings.image?.environment, {
            model: config.embeddings.image?.model,
            image: searchSketch,
        });

        const query: VectorSearchQuery = {
            values: response.values,
            type: SupportedEmbeddingTypes.image
        };

        return query;
    };

    const fireSearch = (type: "text" | "image" = "text") => {
        const generateEmbedding = type === "text" ? generateTextEmbeddings : generateImageEmbeddings;

        generateEmbedding().then((query) => {
            setStatus("Embeddings generated");
            if (!query) {
                return;
            }
            onChange(query);
            setStatus("Searching...");
        });
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            fireSearch("text");
        }
    };

    return (
        <div className="flex gap-1 items-center w-full">
            <Input placeholder="Type what you are looking for, or select a filter" value={searchText} onChange={setSearchText} onKeyDown={handleKeyPress} />
            <Button variant="secondary" isLoading={isLoading} onClick={() => fireSearch("text")} isDisabled={!isReady} alt="semantic search">Search</Button>
        </div>
    );
}
