import { useFetch } from '@vertesia/ui/core';
import { useParams } from '@vertesia/ui/router';
import type { InCodeTypeDefinition } from '@vertesia/common';
import { useAdminContext } from '../AdminContext.js';
import { DetailPage } from '../components/DetailPage.js';

export function TypeDetail() {
    const params = useParams();
    const collection = params.collection;
    const name = params.name;
    const { baseUrl } = useAdminContext();

    const { data: typeDef, isLoading, error } = useFetch<InCodeTypeDefinition>(
        () => fetch(`${baseUrl}/types/${collection}/${name}`).then(r => {
            if (!r.ok) throw new Error(`Failed to load type: ${r.statusText}`);
            return r.json();
        }),
        [baseUrl, collection, name]
    );

    if (isLoading) return <div className="vta-loading">Loading type...</div>;
    if (error || !typeDef) return <div className="vta-error">Failed to load type &ldquo;{name}&rdquo;.</div>;

    return (
        <DetailPage
            type="type"
            title={typeDef.name}
            description={typeDef.description}
            tags={typeDef.tags}
            backHref={`/types/${collection}`}
        >
            {/* Flags */}
            {(typeDef.is_chunkable || typeDef.strict_mode) && (
                <div className="vta-detail-section">
                    <div className="vta-detail-flags">
                        {typeDef.is_chunkable && <span className="vta-detail-flag">Chunkable</span>}
                        {typeDef.strict_mode && <span className="vta-detail-flag">Strict Mode</span>}
                    </div>
                </div>
            )}

            {/* Object Schema */}
            {typeDef.object_schema && (
                <div className="vta-detail-section">
                    <h2>Object Schema</h2>
                    <pre className="vta-detail-code">
                        {JSON.stringify(typeDef.object_schema, null, 2)}
                    </pre>
                </div>
            )}

            {/* Table Layout */}
            {typeDef.table_layout && typeDef.table_layout.length > 0 && (
                <div className="vta-detail-section">
                    <h2>Table Layout</h2>
                    <pre className="vta-detail-code">
                        {JSON.stringify(typeDef.table_layout, null, 2)}
                    </pre>
                </div>
            )}
        </DetailPage>
    );
}
