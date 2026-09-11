import type { ContentObjectTypeNature, ContentObjectTypeStatus } from '@vertesia/common';

export interface ContentObjectTypePresentation {
    nature: ContentObjectTypeNature;
    natureLabelKey: `type.nature${Capitalize<ContentObjectTypeNature>}`;
    status: ContentObjectTypeStatus;
    statusLabelKey: `type.status${Capitalize<ContentObjectTypeStatus>}`;
    statusVariant: 'success' | 'attention';
}

const natureLabelKeys = {
    document: 'type.natureDocument',
    dynamic: 'type.natureDynamic',
    subject: 'type.natureSubject',
    relationship: 'type.natureRelationship',
} as const satisfies Record<ContentObjectTypeNature, ContentObjectTypePresentation['natureLabelKey']>;

const statusLabelKeys = {
    active: 'type.statusActive',
    draft: 'type.statusDraft',
} as const satisfies Record<ContentObjectTypeStatus, ContentObjectTypePresentation['statusLabelKey']>;

export function getContentObjectTypePresentation(
    nature?: ContentObjectTypeNature,
    status?: ContentObjectTypeStatus,
): ContentObjectTypePresentation {
    const resolvedNature = nature ?? 'document';
    const resolvedStatus = status ?? 'active';
    return {
        nature: resolvedNature,
        natureLabelKey: natureLabelKeys[resolvedNature],
        status: resolvedStatus,
        statusLabelKey: statusLabelKeys[resolvedStatus],
        statusVariant: resolvedStatus === 'active' ? 'success' : 'attention',
    };
}
