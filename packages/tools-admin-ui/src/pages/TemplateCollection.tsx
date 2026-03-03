import type { RenderingTemplateDefinitionRef } from '@vertesia/common';
import { Badge, Card, CardContent, Spinner, useFetch } from '@vertesia/ui/core';
import { NavLink, useParams } from '@vertesia/ui/router';

import { useAdminContext } from '../AdminContext.js';
import { DetailPage } from '../components/DetailPage.js';
import { TYPE_VARIANTS } from '../components/typeVariants.js';

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

    if (isLoading) return <div className="flex h-64 items-center justify-center text-muted-foreground"><Spinner /></div>;
    if (error || !templates) return <div className="p-6 text-destructive">Failed to load template collection &ldquo;{collection}&rdquo;.</div>;

    return (
        <DetailPage
            type="template"
            title={collection}
            description={`${templates.length} template${templates.length !== 1 ? 's' : ''} in this collection.`}
        >
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {templates.map(tmpl => (
                    <NavLink
                        key={tmpl.name}
                        href={`/templates/${collection}/${tmpl.name}`}
                        className="no-underline"
                    >
                        <Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-md">
                            <CardContent className="p-5">
                                <span className={`mb-2 inline-block rounded-full px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide ${TYPE_VARIANTS.template}`}>
                                    {tmpl.type || 'template'}
                                </span>
                                <div className="font-semibold text-card-foreground">{tmpl.title || tmpl.name}</div>
                                <div className="mt-1 text-sm text-muted-foreground">{tmpl.description || 'No description'}</div>
                                {tmpl.tags && tmpl.tags.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                        {tmpl.tags.map(tag => (
                                            <Badge key={tag} variant="default">{tag}</Badge>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </NavLink>
                ))}
            </div>
        </DetailPage>
    );
}
