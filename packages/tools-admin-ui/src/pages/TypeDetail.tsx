import type { InCodeTypeDefinition } from '@vertesia/common';
import { Badge, Spinner, useFetch } from '@vertesia/ui/core';
import { useParams } from '@vertesia/ui/router';

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

    if (isLoading) return <div className="flex h-64 items-center justify-center text-muted-foreground"><Spinner /></div>;
    if (error || !typeDef) return <div className="p-6 text-destructive">Failed to load type &ldquo;{name}&rdquo;.</div>;

    return (
        <DetailPage
            type="type"
            title={typeDef.name}
            description={typeDef.description}
            tags={typeDef.tags}
            backHref={`/types/${collection}`}
        >
            {(typeDef.is_chunkable || typeDef.strict_mode) && (
                <div className="mb-8">
                    <div className="flex flex-wrap gap-2">
                        {typeDef.is_chunkable && <Badge variant="success">Chunkable</Badge>}
                        {typeDef.strict_mode && <Badge variant="success">Strict Mode</Badge>}
                    </div>
                </div>
            )}

            {typeDef.object_schema && (
                <div className="mb-8">
                    <h2 className="mb-3 text-lg font-semibold text-foreground">Object Schema</h2>
                    <pre className="whitespace-pre-wrap wrap-break-word rounded-lg border border-border bg-muted-background p-4 font-mono text-sm text-foreground">
                        {JSON.stringify(typeDef.object_schema, null, 2)}
                    </pre>
                </div>
            )}

            {typeDef.table_layout && typeDef.table_layout.length > 0 && (
                <div className="mb-8">
                    <h2 className="mb-3 text-lg font-semibold text-foreground">Table Layout</h2>
                    <pre className="whitespace-pre-wrap wrap-break-word rounded-lg border border-border bg-muted-background p-4 font-mono text-sm text-foreground">
                        {JSON.stringify(typeDef.table_layout, null, 2)}
                    </pre>
                </div>
            )}
        </DetailPage>
    );
}
