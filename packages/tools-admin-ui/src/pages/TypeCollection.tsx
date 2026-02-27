import { useFetch } from '@vertesia/ui/core';
import { useParams, NavLink } from '@vertesia/ui/router';
import type { InCodeTypeDefinition } from '@vertesia/common';
import { useAdminContext } from '../AdminContext.js';
import { DetailPage } from '../components/DetailPage.js';

export function TypeCollection() {
    const collection = useParams('collection');
    const { baseUrl } = useAdminContext();

    const { data: types, isLoading, error } = useFetch<InCodeTypeDefinition[]>(
        () => fetch(`${baseUrl}/types/${collection}`).then(r => {
            if (!r.ok) throw new Error(`Failed to load collection: ${r.statusText}`);
            return r.json();
        }),
        [baseUrl, collection]
    );

    if (isLoading) return <div className="vta-loading">Loading collection...</div>;
    if (error || !types) return <div className="vta-error">Failed to load type collection &ldquo;{collection}&rdquo;.</div>;

    return (
        <DetailPage
            type="type"
            title={collection}
            description={`${types.length} content type${types.length !== 1 ? 's' : ''} in this collection.`}
        >
            <div className="vta-card-grid">
                {types.map(t => {
                    const typeName = t.id?.split(':')[1] || t.name;
                    return (
                        <NavLink
                            key={t.name}
                            href={`/types/${collection}/${typeName}`}
                            className="vta-card-link"
                        >
                            <div className="vta-card vta-card--link">
                                <span className="vta-card-type vta-card-type--type">type</span>
                                <div className="vta-card-title">{t.name}</div>
                                <div className="vta-card-desc">{t.description || 'No description'}</div>
                                {t.tags && t.tags.length > 0 && (
                                    <div className="vta-card-tags">
                                        {t.tags.map(tag => (
                                            <span key={tag} className="vta-tag">{tag}</span>
                                        ))}
                                    </div>
                                )}
                                <div className="vta-card-url">
                                    {t.is_chunkable && 'chunkable'}
                                    {t.is_chunkable && t.strict_mode && ' · '}
                                    {t.strict_mode && 'strict'}
                                </div>
                            </div>
                        </NavLink>
                    );
                })}
            </div>
        </DetailPage>
    );
}
