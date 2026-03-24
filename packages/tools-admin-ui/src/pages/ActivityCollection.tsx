import type { RemoteActivityDefinition } from '@vertesia/common';
import { Card, CardContent, Spinner, useFetch } from '@vertesia/ui/core';
import { useParams } from '@vertesia/ui/router';

import { useAdminContext } from '../AdminContext.js';
import { DetailPage } from '../components/DetailPage.js';
import { TYPE_VARIANTS } from '../components/typeVariants.js';

interface ActivityCollectionResponse {
    title: string;
    description: string;
    activities: RemoteActivityDefinition[];
}

export function ActivityCollection() {
    const collection = useParams('collection');
    const { baseUrl } = useAdminContext();

    const { data, error } = useFetch<ActivityCollectionResponse>(
        () => fetch(`${baseUrl}/activities/${collection}`).then(r => {
            if (!r.ok) throw new Error(`Failed to load collection: ${r.statusText}`);
            return r.json();
        }),
        [baseUrl, collection]
    );

    if (error) return <div className="p-6 text-destructive">Failed to load activity collection &ldquo;{collection}&rdquo;.</div>;
    if (!data) return <div className="flex h-64 items-center justify-center text-muted-foreground"><Spinner /></div>;

    return (
        <DetailPage
            type="activity"
            title={data.title || collection}
            description={data.description || `${data.activities.length} activit${data.activities.length !== 1 ? 'ies' : 'y'} in this collection.`}
        >
            {data.activities.map(activity => (
                <Card key={activity.name} className="mb-4">
                    <CardContent className="p-5">
                        <div className="mb-2 flex items-center gap-2">
                            <span className={`inline-block rounded-full px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide ${TYPE_VARIANTS.activity}`}>
                                activity
                            </span>
                            <span className="font-semibold text-card-foreground">{activity.name}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">{activity.description || 'No description'}</div>
                        {activity.input_schema && (
                            <div className="mt-3">
                                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Input Schema</p>
                                <pre className="whitespace-pre-wrap wrap-break-word rounded-lg border border-border bg-muted-background p-4 font-mono text-sm text-foreground">
                                    {JSON.stringify(activity.input_schema, null, 2)}
                                </pre>
                            </div>
                        )}
                        {activity.output_schema && (
                            <div className="mt-3">
                                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Output Schema</p>
                                <pre className="whitespace-pre-wrap wrap-break-word rounded-lg border border-border bg-muted-background p-4 font-mono text-sm text-foreground">
                                    {JSON.stringify(activity.output_schema, null, 2)}
                                </pre>
                            </div>
                        )}
                    </CardContent>
                </Card>
            ))}
        </DetailPage>
    );
}
