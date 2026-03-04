import { useMemo, useState } from 'react';
import type { ResourceType } from '../types.js';
import { filterResources } from '../types.js';
import { HeroSection, SearchBar, ResourceSection, CollectionCard } from '../components/index.js';
import { useAdminContext } from '../AdminContext.js';

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

            {isSearching ? (
                /* Search mode: show individual resource cards */
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
                /* Browse mode: show collection cards grouped by type */
                sections.map((section, i) => {
                    const sectionCollections = collections.filter(c => c.type === section.type);
                    const mcpResources = section.type === 'mcp'
                        ? resources.filter(r => r.type === 'mcp')
                        : [];

                    if (sectionCollections.length === 0 && mcpResources.length === 0) return null;

                    return (
                        <section key={section.type}>
                            {i > 0 && <hr className="vta-divider" />}
                            <div>
                                <h2 className="vta-section-title">
                                    {section.title}
                                    <span className="vta-section-count">
                                        ({sectionCollections.length}{sectionCollections.length === 1
                                            ? ' collection' : ' collections'})
                                    </span>
                                </h2>
                                <p className="vta-section-subtitle">{section.subtitle}</p>
                            </div>
                            <div className="vta-card-grid">
                                {sectionCollections.map(col => (
                                    <CollectionCard key={`${col.type}:${col.name}`} collection={col} />
                                ))}
                                {mcpResources.map(r => (
                                    <div key={r.name} className="vta-card">
                                        <span className="vta-card-type vta-card-type--mcp">mcp</span>
                                        <div className="vta-card-title">{r.title}</div>
                                        <div className="vta-card-desc">{r.description || 'No description'}</div>
                                        {r.url && <div className="vta-card-url">{r.url}</div>}
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
