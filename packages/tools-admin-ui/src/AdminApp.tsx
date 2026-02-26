import { useMemo, useState } from 'react';
import { useServerInfo, useAppPackage } from './hooks.js';
import type { ResourceItem, ResourceType } from './types.js';
import { buildResources, filterResources } from './types.js';
import { HeroSection, SearchBar, ResourceSection } from './components/index.js';
import adminStyles from './admin.css?inline';

/**
 * Section definitions for the index page.
 */
const sections: { type: ResourceType; title: string; subtitle: string }[] = [
    { type: 'tool', title: 'Tools', subtitle: 'Remote tools available to agents via Vertesia.' },
    { type: 'skill', title: 'Skills', subtitle: 'Reusable instructions and scripts packaged as tools.' },
    { type: 'interaction', title: 'Interactions', subtitle: 'Conversation blueprints surfaced in the Vertesia UI.' },
    { type: 'type', title: 'Content Types', subtitle: 'Schema definitions for structured content in the data store.' },
    { type: 'template', title: 'Rendering Templates', subtitle: 'Document and presentation templates for content generation.' },
    { type: 'mcp', title: 'MCP Providers', subtitle: 'Remote MCP servers available through this tools server.' },
];

export interface AdminAppProps {
    /**
     * Base URL for the tool server API.
     * @default '/api'
     */
    baseUrl?: string;
}

/**
 * Admin index page — displays all tool server resources.
 * CSS is inlined into the JS bundle via Vite's `?inline` import.
 */
export function AdminApp({ baseUrl = '/api' }: AdminAppProps) {
    const { data: serverInfo, isLoading: loadingInfo, error: infoError } = useServerInfo(baseUrl);
    const { data: pkg, isLoading: loadingPkg, error: pkgError } = useAppPackage(baseUrl);
    const [search, setSearch] = useState('');

    const resources = useMemo<ResourceItem[]>(() => {
        if (!pkg) return [];
        return buildResources(
            pkg.tools,
            pkg.interactions,
            pkg.types,
            pkg.templates,
            serverInfo?.endpoints.mcp,
        );
    }, [pkg, serverInfo]);

    const filtered = useMemo(() =>
        filterResources(resources, search),
        [resources, search]
    );

    const isLoading = loadingInfo || loadingPkg;
    const error = infoError || pkgError;

    if (isLoading) {
        return (
            <>
                <style>{adminStyles}</style>
                <div className="vta-loading">Loading...</div>
            </>
        );
    }

    if (error) {
        return (
            <>
                <style>{adminStyles}</style>
                <div className="vta-error">Failed to load server info. Is the API running?</div>
            </>
        );
    }

    if (!serverInfo) return null;

    return (
        <>
            <style>{adminStyles}</style>
            <div className="vta-root">
                <HeroSection
                    title={serverInfo.message.replace('Vertesia Tools API', 'Tools Server')}
                    version={serverInfo.version}
                    resources={resources}
                />

                <SearchBar
                    value={search}
                    onChange={setSearch}
                    placeholder="Search tools, skills, interactions, types, templates..."
                    resultCount={filtered.length}
                    totalCount={resources.length}
                />

                {sections.map((section, i) => {
                    const sectionItems = filtered.filter(r => r.type === section.type);
                    return (
                        <ResourceSection
                            key={section.type}
                            title={section.title}
                            subtitle={section.subtitle}
                            resources={sectionItems}
                            showDivider={i > 0}
                        />
                    );
                })}
            </div>
        </>
    );
}
