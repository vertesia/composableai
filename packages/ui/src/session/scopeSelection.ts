/**
 * Which account/project a tab is working in.
 *
 * Two stores with two jobs. `sessionStorage` holds this tab's own scope: it survives a reload of
 * the tab but is invisible to every other tab, so switching project in one tab cannot re-scope
 * another tab's next token refresh. `localStorage` holds the last selection made in any tab, and
 * only seeds a tab that has no scope of its own yet (a new tab, or the app after a restart).
 */
import { LastSelectedAccountId_KEY, LastSelectedProjectId_KEY } from './constants';

const TabAccountId_KEY = 'composableai.tabAccountId';
const TabProjectId_KEY = 'composableai.tabProjectId';

export interface ScopeSelection {
    accountId?: string;
    projectId?: string;
}

// sessionStorage throws in some sandboxed iframes; the tab then behaves as if it had no scope.
function sessionGet(key: string): string | undefined {
    try {
        return sessionStorage.getItem(key) ?? undefined;
    } catch {
        return undefined;
    }
}

function sessionSet(key: string, value: string | undefined): void {
    try {
        if (value) {
            sessionStorage.setItem(key, value);
        } else {
            sessionStorage.removeItem(key);
        }
    } catch {
        // Without per-tab storage the localStorage default still applies.
    }
}

/**
 * The stored selection, this tab's own first. Without `accountId`, the tab's account wins over the
 * last selection made in any tab. The project is the tab's only when the tab is in that account;
 * a tab in the account but with no project gets no project rather than another tab's.
 */
export function readScopeSelection(accountId?: string): ScopeSelection {
    const tabAccountId = sessionGet(TabAccountId_KEY);
    const account = accountId ?? tabAccountId ?? localStorage.getItem(LastSelectedAccountId_KEY) ?? undefined;
    const projectId =
        tabAccountId && tabAccountId === account
            ? sessionGet(TabProjectId_KEY)
            : (localStorage.getItem(`${LastSelectedProjectId_KEY}-${account}`) ?? undefined);
    return { accountId: account, projectId: projectId || undefined };
}

/** Make this the tab's scope and the default for new tabs. */
export function rememberScopeSelection(accountId: string, projectId?: string): void {
    sessionSet(TabAccountId_KEY, accountId);
    sessionSet(TabProjectId_KEY, projectId);
    localStorage.setItem(LastSelectedAccountId_KEY, accountId);
    localStorage.setItem(`${LastSelectedProjectId_KEY}-${accountId}`, projectId ?? '');
}

/** Drop this tab's scope so its next load falls back to the URL or the default. */
export function forgetTabScopeSelection(): void {
    sessionSet(TabAccountId_KEY, undefined);
    sessionSet(TabProjectId_KEY, undefined);
}

/** Drop a selection STS refused, from this tab and from the defaults, so it is not retried. */
export function forgetRejectedScopeSelection(accountId: string, projectId?: string): void {
    const tabAccountId = sessionGet(TabAccountId_KEY);
    if (tabAccountId === accountId && (!projectId || sessionGet(TabProjectId_KEY) === projectId)) {
        forgetTabScopeSelection();
    }

    const projectKey = `${LastSelectedProjectId_KEY}-${accountId}`;
    if (projectId) {
        const persistedProjectMatches = localStorage.getItem(projectKey) === projectId;
        if (persistedProjectMatches) {
            localStorage.removeItem(projectKey);
        }
        if (persistedProjectMatches && localStorage.getItem(LastSelectedAccountId_KEY) === accountId) {
            localStorage.removeItem(LastSelectedAccountId_KEY);
        }
        return;
    }

    if (localStorage.getItem(LastSelectedAccountId_KEY) === accountId) {
        localStorage.removeItem(LastSelectedAccountId_KEY);
        localStorage.removeItem(projectKey);
    }
}
