import { describe, expect, it } from 'vitest';
import { stripWorkflowContinuationFromVars } from './dslProxyActivities.js';

describe('stripWorkflowContinuationFromVars', () => {
    it('removes continue-as-new state from activity vars', () => {
        const vars = {
            interaction: 'sys:AppDeveloper',
            _continuation: {
                conversationState: { large: true },
            },
        };

        expect(stripWorkflowContinuationFromVars(vars)).toEqual({
            interaction: 'sys:AppDeveloper',
        });
        expect(vars).toHaveProperty('_continuation');
    });

    it('returns primitive and array vars unchanged', () => {
        expect(stripWorkflowContinuationFromVars(undefined)).toBeUndefined();
        expect(stripWorkflowContinuationFromVars(['a'])).toEqual(['a']);
    });
});
