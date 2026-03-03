import { Card, CardContent } from '@vertesia/ui/core';
import { NavLink } from '@vertesia/ui/router';

import type { CollectionInfo } from '../types.js';
import { TYPE_VARIANTS } from './typeVariants.js';

export function CollectionCard({ collection }: { collection: CollectionInfo }) {
    const href = `/${collection.type}s/${collection.name}`;

    return (
        <NavLink href={href} className="block no-underline">
            <Card className="cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md">
                <CardContent className="p-5">
                    <span className={`mb-2 inline-block rounded-full px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide ${TYPE_VARIANTS[collection.type] ?? ''}`}>
                        {collection.type}
                    </span>
                    <div className="font-semibold text-card-foreground">{collection.title}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                        {collection.description || 'No description'}
                    </div>
                    <div className="mt-2 font-mono text-xs text-muted-foreground">
                        {collection.count} {collection.count === 1 ? 'item' : 'items'}
                    </div>
                </CardContent>
            </Card>
        </NavLink>
    );
}
