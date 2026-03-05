import { Separator } from '@vertesia/ui/core';
import { useMemo, useState } from 'react';

import { useAdminContext } from '../AdminContext.js';
import { CollectionCard, HeroSection, ResourceSection, SearchBar } from '../components/index.js';
import { TYPE_VARIANTS } from '../components/typeVariants.js';
import type { ResourceType } from '../types.js';
import { filterResources } from '../types.js';

const sections: { type: ResourceType; title: string; subtitle: string }[] = [
    { type: 'tool', title: 'Tools', subtitle: 'Remote tools available to agents via Vertesia.' },
    { type: 'skill', title: 'Skills', subtitle: 'Reusable instructions and scripts packaged as tools.' },
    { type: 'interaction', title: 'Interactions', subtitle: 'Conversation blueprints surfaced in the Vertesia UI.' },
    { type: 'type', title: 'Content Types', subtitle: 'Schema definitions for structured content in the data store.' },
    { type: 'template', title: 'Rendering Templates', subtitle: 'Document and presentation templates for content generation.' },
    { type: 'mcp', title: 'MCP Providers', subtitle: 'Remote MCP servers available through this tools server.' },
];

export function HomePage() {
    const { serverInfo, collections, resources } = useAdminContext();
    const [search, setSearch] = useState('');

    const filtered = useMemo(() =>
        filterResources(resources, search),
        [resources, search]
    );

    const isSearching = search.trim().length > 0;

    return (
        <div className="mx-auto max-w-5xl px-7 py-10">
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

            {isSearching ? (
                sections.map((section, i) => {
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
                })
            ) : (
                sections.map((section, i) => {
                    const sectionCollections = collections.filter(c => c.type === section.type);
                    const mcpResources = section.type === 'mcp'
                        ? resources.filter(r => r.type === 'mcp')
                        : [];

                    if (sectionCollections.length === 0 && mcpResources.length === 0) return null;

                    return (
                        <section key={section.type}>
                            {i > 0 && <Separator className="my-8" />}
                            <div>
                                <h2 className="text-xl font-semibold text-foreground">
                                    {section.title}
                                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                                        ({sectionCollections.length}{sectionCollections.length === 1
                                            ? ' collection' : ' collections'})
                                    </span>
                                </h2>
                                <p className="mb-4 text-sm text-muted-foreground">{section.subtitle}</p>
                            </div>
                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                {sectionCollections.map(col => (
                                    <CollectionCard key={`${col.type}:${col.name}`} collection={col} />
                                ))}
                                {mcpResources.map(r => (
                                    <div key={r.name} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                                        <span className={`mb-2 inline-block rounded-full px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide ${TYPE_VARIANTS.mcp}`}>
                                            mcp
                                        </span>
                                        <div className="font-semibold text-card-foreground">{r.title}</div>
                                        <div className="mt-1 text-sm text-muted-foreground">{r.description || 'No description'}</div>
                                        {r.url && <div className="mt-2 truncate font-mono text-xs text-muted-foreground">{r.url}</div>}
                                    </div>
                                ))}
                            </div>
                        </section>
                    );
                })
            )}
        </div>
    );
}
