import type { CatalogInteractionRef } from '@vertesia/common';
import { Badge, Card, CardContent, Spinner, useFetch } from '@vertesia/ui/core';
import { NavLink, useParams } from '@vertesia/ui/router';

import { useAdminContext } from '../AdminContext.js';
import { DetailPage } from '../components/DetailPage.js';
import { TYPE_VARIANTS } from '../components/typeVariants.js';

export function InteractionCollection() {
    const collection = useParams('collection');
    const { baseUrl } = useAdminContext();

    const { data: interactions, isLoading, error } = useFetch<CatalogInteractionRef[]>(
        () => fetch(`${baseUrl}/interactions/${collection}`).then(r => {
            if (!r.ok) throw new Error(`Failed to load collection: ${r.statusText}`);
            return r.json();
        }),
        [baseUrl, collection]
    );

    if (isLoading) {
        return <div className="flex h-64 items-center justify-center text-muted-foreground"><Spinner /></div>;
    }

    if (error || !interactions) {
        return <div className="p-6 text-destructive">Failed to load collection &ldquo;{collection}&rdquo;.</div>;
    }

    return (
        <DetailPage
            type="interaction"
            title={collection}
            description={`${interactions.length} interaction${interactions.length !== 1 ? 's' : ''} in this collection.`}
        >
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {interactions.map(inter => (
                    <NavLink key={inter.id} href={`/interactions/${collection}/${inter.name}`} className="block no-underline">
                        <Card className="cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md">
                            <CardContent className="p-5">
                                <span className={`mb-2 inline-block rounded-full px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide ${TYPE_VARIANTS.interaction}`}>
                                    interaction
                                </span>
                                <div className="font-semibold text-card-foreground">{inter.title || inter.name}</div>
                                <div className="mt-1 text-sm text-muted-foreground">{inter.description || 'No description'}</div>
                                {inter.tags && inter.tags.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        {inter.tags.map(tag => <Badge key={tag}>{tag}</Badge>)}
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
