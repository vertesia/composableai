// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LastSelectedAccountId_KEY, LastSelectedProjectId_KEY } from './constants';
import {
    forgetRejectedScopeSelection,
    forgetTabScopeSelection,
    readScopeSelection,
    rememberScopeSelection,
} from './scopeSelection';

vi.mock('@vertesia/ui/env', () => ({
    Env: { endpoints: { sts: 'https://sts.test', studio: 'https://studio.test' } },
}));

/** What a project switch in another tab leaves in the shared store. */
function selectInOtherTab(accountId: string, projectId: string) {
    localStorage.setItem(LastSelectedAccountId_KEY, accountId);
    localStorage.setItem(`${LastSelectedProjectId_KEY}-${accountId}`, projectId);
}

describe('scope selection', () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
    });

    it("keeps this tab's scope when another tab selects a different project", () => {
        rememberScopeSelection('account-1', 'project-a');
        selectInOtherTab('account-1', 'project-b');

        expect(readScopeSelection()).toEqual({ accountId: 'account-1', projectId: 'project-a' });
    });

    it("keeps this tab's account when another tab selects a different account", () => {
        rememberScopeSelection('account-1', 'project-a');
        selectInOtherTab('account-2', 'project-c');

        expect(readScopeSelection()).toEqual({ accountId: 'account-1', projectId: 'project-a' });
    });

    it('seeds a tab without its own scope from the last selection in any tab', () => {
        selectInOtherTab('account-1', 'project-b');

        expect(readScopeSelection()).toEqual({ accountId: 'account-1', projectId: 'project-b' });
    });

    it("uses the account's last project when asked for an account other than the tab's", () => {
        rememberScopeSelection('account-1', 'project-a');
        selectInOtherTab('account-2', 'project-c');

        expect(readScopeSelection('account-2')).toEqual({ accountId: 'account-2', projectId: 'project-c' });
    });

    it("does not borrow another tab's project for a tab scoped to the account only", () => {
        rememberScopeSelection('account-1');
        selectInOtherTab('account-1', 'project-b');

        expect(readScopeSelection()).toEqual({ accountId: 'account-1', projectId: undefined });
    });

    it('falls back to the last selection once the tab scope is forgotten', () => {
        rememberScopeSelection('account-1', 'project-a');
        selectInOtherTab('account-1', 'project-b');
        forgetTabScopeSelection();

        expect(readScopeSelection()).toEqual({ accountId: 'account-1', projectId: 'project-b' });
    });

    it('forgets a rejected project from the tab and the defaults', () => {
        rememberScopeSelection('account-1', 'project-a');
        forgetRejectedScopeSelection('account-1', 'project-a');

        expect(readScopeSelection()).toEqual({ accountId: undefined, projectId: undefined });
    });

    it("keeps the tab's scope when another tab's project is rejected", () => {
        rememberScopeSelection('account-1', 'project-a');
        forgetRejectedScopeSelection('account-1', 'project-b');

        expect(readScopeSelection()).toEqual({ accountId: 'account-1', projectId: 'project-a' });
    });
});
