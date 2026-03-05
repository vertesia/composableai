import { Badge, Spinner, useFetch } from '@vertesia/ui/core';
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

    const { data: template, error } = useFetch<TemplateDefinitionResponse>(
        () => fetch(`${baseUrl}/templates/${collection}/${name}`).then(r => {
            if (!r.ok) throw new Error(`Failed to load template: ${r.statusText}`);
            return r.json();
        }),
        [baseUrl, collection, name]
    );

    if (error) return <div className="p-6 text-destructive">Failed to load template &ldquo;{name}&rdquo;.</div>;
    if (!template) return <div className="flex h-64 items-center justify-center text-muted-foreground"><Spinner /></div>;

    return (
        <DetailPage
            type="template"
            title={template.title || template.name}
            description={template.description}
            tags={template.tags}
            backHref={`/templates/${collection}`}
        >
            <div className="mb-8">
                <div className="flex flex-wrap gap-2">
                    <Badge variant="success">{template.type}</Badge>
                </div>
            </div>

            {template.assets && template.assets.length > 0 && (
                <div className="mb-8">
                    <h2 className="mb-3 text-lg font-semibold text-foreground">Assets</h2>
                    <div className="flex flex-wrap gap-2">
                        {template.assets.map(asset => (
                            <Badge key={asset} variant="success">
                                {asset.split('/').pop()}
                            </Badge>
                        ))}
                    </div>
                </div>
            )}

            <div className="mb-8">
                <h2 className="mb-3 text-lg font-semibold text-foreground">Instructions</h2>
                <pre className="whitespace-pre-wrap wrap-break-word rounded-lg border border-border bg-muted-background p-4 font-mono text-sm text-foreground">
                    {template.instructions}
                </pre>
            </div>
        </DetailPage>
    );
}
