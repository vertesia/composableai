import { useFetch } from '@vertesia/ui/core';
import { useParams, NavLink } from '@vertesia/ui/router';
import type { RenderingTemplateDefinitionRef } from '@vertesia/common';
import { useAdminContext } from '../AdminContext.js';
import { DetailPage } from '../components/DetailPage.js';

export function TemplateCollection() {
    const collection = useParams('collection');
    const { baseUrl } = useAdminContext();

    const { data: templates, isLoading, error } = useFetch<RenderingTemplateDefinitionRef[]>(
        () => fetch(`${baseUrl}/templates/${collection}`).then(r => {
            if (!r.ok) throw new Error(`Failed to load collection: ${r.statusText}`);
            return r.json();
        }),
        [baseUrl, collection]
    );

    if (isLoading) return <div className="vta-loading">Loading collection...</div>;
    if (error || !templates) return <div className="vta-error">Failed to load template collection &ldquo;{collection}&rdquo;.</div>;

    return (
        <DetailPage
            type="template"
            title={collection}
            description={`${templates.length} template${templates.length !== 1 ? 's' : ''} in this collection.`}
        >
            <div className="vta-card-grid">
                {templates.map(tmpl => (
                    <NavLink
                        key={tmpl.name}
                        href={`/templates/${collection}/${tmpl.name}`}
                        className="vta-card-link"
                    >
                        <div className="vta-card vta-card--link">
                            <div className="vta-card-type vta-card-type--template">
                                {tmpl.type || 'template'}
                            </div>
                            <div className="vta-card-title">{tmpl.title || tmpl.name}</div>
                            <div className="vta-card-desc">{tmpl.description || 'No description'}</div>
                            {tmpl.tags && tmpl.tags.length > 0 && (
                                <div className="vta-card-tags">
                                    {tmpl.tags.map(tag => (
                                        <span key={tag} className="vta-tag">{tag}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </NavLink>
                ))}
            </div>
        </DetailPage>
    );
}
