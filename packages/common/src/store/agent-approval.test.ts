import { describe, expect, it } from 'vitest';
import { normalizeAgentToolApprovalMode } from './agent-approval.js';

describe('normalizeAgentToolApprovalMode', () => {
    it('defaults interactive runs to full_control when no mode is supplied', () => {
        expect(normalizeAgentToolApprovalMode(undefined, true)).toBe('full_control');
    });

    it('keeps supplied modes for interactive runs', () => {
        expect(normalizeAgentToolApprovalMode('ask', true)).toBe('ask');
        expect(normalizeAgentToolApprovalMode('auto_review', true)).toBe('auto_review');
    });

    it('forces non-interactive runs to full_control', () => {
        expect(normalizeAgentToolApprovalMode('ask', false)).toBe('full_control');
        expect(normalizeAgentToolApprovalMode('auto_review', undefined)).toBe('full_control');
    });
});
