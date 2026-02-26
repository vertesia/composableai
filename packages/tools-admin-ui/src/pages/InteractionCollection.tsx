import { useFetch } from '@vertesia/ui/core';
import { useParams, NavLink } from '@vertesia/ui/router';
import type { CatalogInteractionRef } from '@vertesia/common';
import { useAdminContext } from '../AdminContext.js';
import { DetailPage } from '../components/DetailPage.js';

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
        return <div className="vta-loading">Loading collection...</div>;
    }

    if (error || !interactions) {
        return <div className="vta-error">Failed to load collection &ldquo;{collection}&rdquo;.</div>;
    }

    return (
        <DetailPage
            type="interaction"
            title={collection}
            description={`${interactions.length} interaction${interactions.length !== 1 ? 's' : ''} in this collection.`}
        >
            <div className="vta-card-grid">
                {interactions.map(inter => (
                    <NavLink
                        key={inter.id}
                        href={`/interactions/${collection}/${inter.name}`}
                        className="vta-card-link"
                    >
                        <div className="vta-card vta-card--link">
                            <span className="vta-card-type vta-card-type--interaction">interaction</span>
                            <div className="vta-card-title">{inter.title || inter.name}</div>
                            <div className="vta-card-desc">
                                {inter.description || 'No description'}
                            </div>
                            {inter.tags && inter.tags.length > 0 && (
                                <div className="vta-card-tags">
                                    {inter.tags.map(tag => (
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
