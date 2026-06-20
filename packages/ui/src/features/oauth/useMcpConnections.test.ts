import { describe, expect, it } from 'vitest';
import {
    countConnectedActiveGroups,
    getConnectedActiveGroupLabels,
    isGroupDisabled,
    type McpConnectionGroup,
    toggleGroupDisabled,
} from './useMcpConnections.js';

function group(memberIds: string[], authenticated?: boolean, label = 'Server'): McpConnectionGroup {
    return {
        key: `k:${memberIds.join(',')}`,
        appId: 'app1',
        appName: 'App',
        label,
        representativeId: memberIds[0],
        memberIds,
        memberNames: memberIds,
        authStatus:
            authenticated === undefined
                ? undefined
                : {
                      authenticated,
                      collection_id: memberIds[0],
                      collection_name: memberIds[0],
                      mcp_server_url: 'https://mcp.example.com',
                  },
    };
}

describe('isGroupDisabled', () => {
    it('is active (not disabled) when the disabled set is empty or undefined', () => {
        const g = group(['a']);
        expect(isGroupDisabled(g, undefined)).toBe(false);
        expect(isGroupDisabled(g, [])).toBe(false);
    });

    it('is disabled only when every member id is in the disabled set', () => {
        const g = group(['a', 'b']);
        expect(isGroupDisabled(g, ['a'])).toBe(false);
        expect(isGroupDisabled(g, ['a', 'b'])).toBe(true);
    });
});

describe('countConnectedActiveGroups', () => {
    it('counts only connected groups that are not disabled', () => {
        expect(
            countConnectedActiveGroups(
                [
                    group(['connected'], true),
                    group(['not-connected'], false),
                    group(['unknown-status']),
                    group(['connected-disabled'], true),
                ],
                ['connected-disabled'],
            ),
        ).toBe(1);
    });
});

describe('getConnectedActiveGroupLabels', () => {
    it('returns only connected groups that are not disabled', () => {
        expect(
            getConnectedActiveGroupLabels(
                [
                    group(['jira'], true, 'Jira'),
                    group(['github'], false, 'GitHub'),
                    group(['miro'], true, 'Miro'),
                    group(['linear'], true, 'Linear'),
                ],
                ['linear'],
            ),
        ).toEqual(['Jira', 'Miro']);
    });
});

describe('toggleGroupDisabled', () => {
    it('disabling adds all member ids', () => {
        const g = group(['a', 'b']);
        expect(toggleGroupDisabled(g, undefined, /* active */ false).sort()).toEqual(['a', 'b']);
    });

    it('enabling removes all member ids and keeps others', () => {
        const g = group(['a', 'b']);
        expect(toggleGroupDisabled(g, ['a', 'b', 'c'], /* active */ true)).toEqual(['c']);
    });

    it('round-trips back to the original set', () => {
        const g = group(['a']);
        const disabled = toggleGroupDisabled(g, [], false);
        expect(disabled).toEqual(['a']);
        expect(toggleGroupDisabled(g, disabled, true)).toEqual([]);
    });
});
