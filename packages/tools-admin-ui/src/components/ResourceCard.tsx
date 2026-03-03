import { Badge, Card, CardContent } from '@vertesia/ui/core';

import type { ResourceItem } from '../types.js';
import { TYPE_VARIANTS } from './typeVariants.js';

export function ResourceCard({ resource }: { resource: ResourceItem }) {
    return (
        <Card className="transition-all hover:-translate-y-0.5 hover:shadow-md">
            <CardContent className="p-5">
                <span className={`mb-2 inline-block rounded-full px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide ${TYPE_VARIANTS[resource.type] ?? ''}`}>
                    {resource.type}
                </span>
                <div className="font-semibold text-card-foreground">{resource.title}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                    {resource.description || 'No description'}
                </div>
                {resource.tags && resource.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                        {resource.tags.map(tag => (
                            <Badge key={tag} variant="default">{tag}</Badge>
                        ))}
                    </div>
                )}
                {resource.url && (
                    <div className="mt-2 truncate font-mono text-xs text-muted-foreground">{resource.url}</div>
                )}
            </CardContent>
        </Card>
    );
}
