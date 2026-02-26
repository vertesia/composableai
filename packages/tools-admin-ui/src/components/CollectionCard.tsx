import { NavLink } from '@vertesia/ui/router';
import type { CollectionInfo } from '../types.js';

const linkableTypes = new Set(['interaction']);

function getCollectionHref(collection: CollectionInfo): string | undefined {
    if (!linkableTypes.has(collection.type)) return undefined;
    return `/${collection.type}s/${collection.name}`;
}

export function CollectionCard({ collection }: { collection: CollectionInfo }) {
    const href = getCollectionHref(collection);

    const card = (
        <div className={`vta-card${href ? ' vta-card--link' : ''}`}>
            <span className={`vta-card-type vta-card-type--${collection.type}`}>
                {collection.type}
            </span>
            <div className="vta-card-title">{collection.title}</div>
            <div className="vta-card-desc">
                {collection.description || 'No description'}
            </div>
            <div className="vta-card-url">
                {collection.count} {collection.count === 1 ? 'item' : 'items'}
            </div>
        </div>
    );

    if (href) {
        return <NavLink href={href} className="vta-card-link">{card}</NavLink>;
    }

    return card;
}
