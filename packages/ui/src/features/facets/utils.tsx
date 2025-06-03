import { FacetBucket, FacetNameBucket } from '@vertesia/common';

export function facetOptionLabel(bucket: FacetBucket) {
    return `${bucket._id} (${bucket.count})`;
}

export function facetOptionNameLabel(bucket: FacetNameBucket) {
    return `${bucket.name} (${bucket.count})`;
}