import { useFetch } from '@vertesia/ui/core';
import { useParams } from '@vertesia/ui/router';
import { useAdminContext } from '../AdminContext.js';
import { DetailPage } from '../components/DetailPage.js';

interface TemplateDefinitionResponse {
    name: string;
    title?: string;
    description: string;
    type: 'presentation' | 'document';
    tags?: string[];
    assets: string[];
    instructions: string;
}

export function TemplateDetail() {
    const params = useParams();
    const collection = params.collection;
    const name = params.name;
    const { baseUrl } = useAdminContext();

    const { data: template, isLoading, error } = useFetch<TemplateDefinitionResponse>(
        () => fetch(`${baseUrl}/templates/${collection}/${name}`).then(r => {
            if (!r.ok) throw new Error(`Failed to load template: ${r.statusText}`);
            return r.json();
        }),
        [baseUrl, collection, name]
    );

    if (isLoading) return <div className="vta-loading">Loading template...</div>;
    if (error || !template) return <div className="vta-error">Failed to load template &ldquo;{name}&rdquo;.</div>;

    return (
        <DetailPage
            type="template"
            title={template.title || template.name}
            description={template.description}
            tags={template.tags}
            backHref={`/templates/${collection}`}
        >
            {/* Type badge & Assets */}
            <div className="vta-detail-section">
                <div className="vta-detail-flags">
                    <span className="vta-detail-flag">{template.type}</span>
                </div>
            </div>

            {template.assets && template.assets.length > 0 && (
                <div className="vta-detail-section">
                    <h2>Assets</h2>
                    <div className="vta-detail-flags">
                        {template.assets.map(asset => (
                            <span key={asset} className="vta-detail-flag">
                                {asset.split('/').pop()}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Instructions */}
            <div className="vta-detail-section">
                <h2>Instructions</h2>
                <pre className="vta-detail-code">{template.instructions}</pre>
            </div>
        </DetailPage>
    );
}
