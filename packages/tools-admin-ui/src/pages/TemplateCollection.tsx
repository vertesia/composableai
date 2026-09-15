import type { RenderingTemplateDefinitionRef } from '@vertesia/common';
import { Badge, Card, CardContent, useFetch } from '@vertesia/ui/core';
import { NavLink, useParams } from '@vertesia/ui/router';
import { useAdminContext } from '../AdminContext.js';
import { AdminLoadingPage } from '../components/AdminLoadingPage.js';
import { DetailPage } from '../components/DetailPage.js';
import { TYPE_VARIANTS } from '../components/typeVariants.js';

export function TemplateCollection() {
    const collection = useParams('collection');
    const { baseUrl } = useAdminContext();

    const { data: templates, error } = useFetch<RenderingTemplateDefinitionRef[]>(
        () =>
            fetch(`${baseUrl}/templates/${collection}`).then((r) => {
                if (!r.ok) throw new Error(`Failed to load collection: ${r.statusText}`);
                return r.json();
            }),
        [baseUrl, collection],
    );

    if (error)
        return (
            <div className="p-6 text-destructive">Failed to load template collection &ldquo;{collection}&rdquo;.</div>
        );
    if (!templates) return <AdminLoadingPage />;

    return (
        <DetailPage
            type="template"
            title={collection}
            description={`${templates.length} template${templates.length !== 1 ? 's' : ''} in this collection.`}
        >
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {templates.map((tmpl) => (
                    <NavLink key={tmpl.name} href={`/templates/${collection}/${tmpl.name}`} className="no-underline">
                        <Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-md">
                            <CardContent className="p-5">
                                <span
                                    className={`mb-2 inline-block rounded-full px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide ${TYPE_VARIANTS.template}`}
                                >
                                    {tmpl.type || 'template'}
                                </span>
                                <div className="font-semibold text-card-foreground">{tmpl.title || tmpl.name}</div>
                                <div className="mt-1 text-sm text-muted">{tmpl.description || 'No description'}</div>
                                {tmpl.tags && tmpl.tags.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                        {tmpl.tags.map((tag) => (
                                            <Badge key={tag} variant="default">
                                                {tag}
                                            </Badge>
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
