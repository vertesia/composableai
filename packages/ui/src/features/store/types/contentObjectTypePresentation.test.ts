import { describe, expect, it } from 'vitest';
import { getContentObjectTypePresentation } from './contentObjectTypePresentation.js';

describe('getContentObjectTypePresentation', () => {
    it('presents legacy types as active documents', () => {
        expect(getContentObjectTypePresentation()).toEqual({
            nature: 'document',
            natureLabelKey: 'type.natureDocument',
            status: 'active',
            statusLabelKey: 'type.statusActive',
            statusVariant: 'success',
        });
    });

    it('presents draft relationship types distinctly', () => {
        expect(getContentObjectTypePresentation('relationship', 'draft')).toEqual({
            nature: 'relationship',
            natureLabelKey: 'type.natureRelationship',
            status: 'draft',
            statusLabelKey: 'type.statusDraft',
            statusVariant: 'attention',
        });
    });
});
