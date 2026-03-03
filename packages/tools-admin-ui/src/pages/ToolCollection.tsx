import { Card, CardContent, Spinner, useFetch } from '@vertesia/ui/core';
import { useParams } from '@vertesia/ui/router';

import { useAdminContext } from '../AdminContext.js';
import { DetailPage } from '../components/DetailPage.js';
import { TYPE_VARIANTS } from '../components/typeVariants.js';

interface ToolDef {
    name: string;
    description?: string;
    input_schema?: Record<string, unknown>;
}

interface ToolCollectionResponse {
    title: string;
    description: string;
    tools: ToolDef[];
}

export function ToolCollection() {
    const collection = useParams('collection');
    const { baseUrl } = useAdminContext();

    const { data, isLoading, error } = useFetch<ToolCollectionResponse>(
        () => fetch(`${baseUrl}/tools/${collection}`).then(r => {
            if (!r.ok) throw new Error(`Failed to load collection: ${r.statusText}`);
            return r.json();
        }),
        [baseUrl, collection]
    );

    if (isLoading) return <div className="flex h-64 items-center justify-center text-muted-foreground"><Spinner /></div>;
    if (error || !data) return <div className="p-6 text-destructive">Failed to load tool collection &ldquo;{collection}&rdquo;.</div>;

    return (
        <DetailPage
            type="tool"
            title={data.title || collection}
            description={data.description || `${data.tools.length} tool${data.tools.length !== 1 ? 's' : ''} in this collection.`}
        >
            {data.tools.map(tool => (
                <Card key={tool.name} className="mb-4">
                    <CardContent className="p-5">
                        <div className="mb-2 flex items-center gap-2">
                            <span className={`inline-block rounded-full px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide ${TYPE_VARIANTS.tool}`}>
                                tool
                            </span>
                            <span className="font-semibold text-card-foreground">{tool.name}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">{tool.description || 'No description'}</div>
                        {tool.input_schema && (
                            <pre className="mt-3 whitespace-pre-wrap wrap-break-word rounded-lg border border-border bg-muted-background p-4 font-mono text-sm text-foreground">
                                {JSON.stringify(tool.input_schema, null, 2)}
                            </pre>
                        )}
                    </CardContent>
                </Card>
            ))}
        </DetailPage>
    );
}
