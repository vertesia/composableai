import { useFetch } from '@vertesia/ui/core';
import { useParams } from '@vertesia/ui/router';
import { useAdminContext } from '../AdminContext.js';
import { DetailPage } from '../components/DetailPage.js';

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

    if (isLoading) return <div className="vta-loading">Loading collection...</div>;
    if (error || !data) return <div className="vta-error">Failed to load tool collection &ldquo;{collection}&rdquo;.</div>;

    return (
        <DetailPage
            type="tool"
            title={data.title || collection}
            description={data.description || `${data.tools.length} tool${data.tools.length !== 1 ? 's' : ''} in this collection.`}
        >
            {data.tools.map(tool => (
                <div key={tool.name} className="vta-detail-card">
                    <div className="vta-detail-card-header">
                        <span className="vta-card-type vta-card-type--tool">tool</span>
                        <div className="vta-card-title">{tool.name}</div>
                    </div>
                    <div className="vta-card-desc">{tool.description || 'No description'}</div>
                    {tool.input_schema && (
                        <pre className="vta-detail-code">
                            {JSON.stringify(tool.input_schema, null, 2)}
                        </pre>
                    )}
                </div>
            ))}
        </DetailPage>
    );
}
