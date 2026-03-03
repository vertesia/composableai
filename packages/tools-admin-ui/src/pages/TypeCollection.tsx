import type { InCodeTypeDefinition } from '@vertesia/common';
import { Badge, Card, CardContent, Spinner, useFetch } from '@vertesia/ui/core';
import { NavLink, useParams } from '@vertesia/ui/router';

import { useAdminContext } from '../AdminContext.js';
import { DetailPage } from '../components/DetailPage.js';
import { TYPE_VARIANTS } from '../components/typeVariants.js';

export function TypeCollection() {
    const collection = useParams('collection');
    const { baseUrl } = useAdminContext();

    const { data: types, error } = useFetch<InCodeTypeDefinition[]>(
        () => fetch(`${baseUrl}/types/${collection}`).then(r => {
            if (!r.ok) throw new Error(`Failed to load collection: ${r.statusText}`);
            return r.json();
        }),
        [baseUrl, collection]
    );

    if (error) return <div className="p-6 text-destructive">Failed to load type collection &ldquo;{collection}&rdquo;.</div>;
    if (!types) return <div className="flex h-64 items-center justify-center text-muted-foreground"><Spinner /></div>;

    return (
        <DetailPage
            type="type"
            title={collection}
            description={`${types.length} content type${types.length !== 1 ? 's' : ''} in this collection.`}
        >
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {types.map(t => {
                    const typeName = t.id?.split(':')[1] || t.name;
                    return (
                        <NavLink
                            key={t.name}
                            href={`/types/${collection}/${typeName}`}
                            className="no-underline"
                        >
                            <Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-md">
                                <CardContent className="p-5">
                                    <span className={`mb-2 inline-block rounded-full px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide ${TYPE_VARIANTS.type}`}>
                                        type
                                    </span>
                                    <div className="font-semibold text-card-foreground">{t.name}</div>
                                    <div className="mt-1 text-sm text-muted-foreground">{t.description || 'No description'}</div>
                                    {t.tags && t.tags.length > 0 && (
                                        <div className="mt-3 flex flex-wrap gap-1.5">
                                            {t.tags.map(tag => (
                                                <Badge key={tag} variant="default">{tag}</Badge>
                                            ))}
                                        </div>
                                    )}
                                    {(t.is_chunkable || t.strict_mode) && (
                                        <div className="mt-2 truncate font-mono text-xs text-muted-foreground">
                                            {t.is_chunkable && 'chunkable'}
                                            {t.is_chunkable && t.strict_mode && ' · '}
                                            {t.strict_mode && 'strict'}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </NavLink>
                    );
                })}
            </div>
        </DetailPage>
    );
}
