import { useMemo } from 'react';
import { useFetch } from '@vertesia/ui/core';
import { useParams, NavLink } from '@vertesia/ui/router';
import { useAdminContext } from '../AdminContext.js';
import { DetailPage } from '../components/DetailPage.js';

interface SkillToolDef {
    name: string;
    description?: string;
    related_tools?: string[];
}

interface SkillCollectionResponse {
    title: string;
    description: string;
    tools: SkillToolDef[];
}

interface WidgetInfo {
    skill: string;
    collection: string;
    url: string;
}

interface WidgetsResponse {
    widgets: Record<string, WidgetInfo>;
}

/** Strip the learn_ prefix added by the SDK when exposing skills as tools. */
function skillDisplayName(name: string): string {
    return name.startsWith('learn_') ? name.slice(6) : name;
}

export function SkillCollection() {
    const collection = useParams('collection');
    const { baseUrl } = useAdminContext();

    const { data, isLoading, error } = useFetch<SkillCollectionResponse>(
        () => fetch(`${baseUrl}/skills/${collection}`).then(r => {
            if (!r.ok) throw new Error(`Failed to load collection: ${r.statusText}`);
            return r.json();
        }),
        [baseUrl, collection]
    );

    const { data: widgetsData } = useFetch<WidgetsResponse>(
        () => fetch(`${baseUrl}/package?scope=widgets`).then(r => r.ok ? r.json() : { widgets: {} }),
        [baseUrl]
    );

    const collectionWidgets = useMemo(() => {
        if (!widgetsData?.widgets) return [];
        return Object.entries(widgetsData.widgets)
            .filter(([_, w]) => w.collection === collection)
            .map(([name, w]) => ({ name, ...w }));
    }, [widgetsData, collection]);

    if (isLoading) return <div className="vta-loading">Loading collection...</div>;
    if (error || !data) return <div className="vta-error">Failed to load skill collection &ldquo;{collection}&rdquo;.</div>;

    return (
        <DetailPage
            type="skill"
            title={data.title || collection}
            description={data.description || `${data.tools.length} skill${data.tools.length !== 1 ? 's' : ''} in this collection.`}
        >
            {/* Widgets provided by this collection */}
            {collectionWidgets.length > 0 && (
                <div className="vta-detail-section">
                    <h2>Widgets</h2>
                    <div className="vta-detail-flags">
                        {collectionWidgets.map(w => (
                            <span key={w.name} className="vta-detail-flag">
                                {w.name}
                                <span className="vta-card-url" style={{ marginLeft: '0.5rem' }}>
                                    (skill: {w.skill})
                                </span>
                            </span>
                        ))}
                    </div>
                </div>
            )}

            <div className="vta-card-grid">
                {data.tools.map(skill => {
                    const displayName = skillDisplayName(skill.name);
                    return (
                        <NavLink
                            key={skill.name}
                            href={`/skills/${collection}/${displayName}`}
                            className="vta-card-link"
                        >
                            <div className="vta-card vta-card--link">
                                <span className="vta-card-type vta-card-type--skill">skill</span>
                                <div className="vta-card-title">{displayName}</div>
                                <div className="vta-card-desc">{skill.description || 'No description'}</div>
                                {skill.related_tools && skill.related_tools.length > 0 && (
                                    <div className="vta-card-tags">
                                        {skill.related_tools.map(t => (
                                            <span key={t} className="vta-tag">{t}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </NavLink>
                    );
                })}
            </div>
        </DetailPage>
    );
}
