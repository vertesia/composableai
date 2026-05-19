import { describe, expect, it } from 'vitest';
import {
    DenialsMatcher,
    expandToolPattern,
    filterDeniedTools,
    isToolDenied,
    isUiDenied,
    makeToolId,
    type Denials,
} from './denials.js';

describe('makeToolId', () => {
    it('builds a 3-segment URI from app/category/name', () => {
        expect(makeToolId('slack', 'messaging', 'send_message')).toBe('slack:messaging:send_message');
    });

    it('represents missing category as empty segment', () => {
        expect(makeToolId('app', undefined, 'name')).toBe('app::name');
    });
});

describe('expandToolPattern', () => {
    it('passes through full 3-segment patterns', () => {
        expect(expandToolPattern('app:coll:tool')).toEqual(['app', 'coll', 'tool']);
    });

    it('expands "app:*" to "app:*:*"', () => {
        expect(expandToolPattern('slack:*')).toEqual(['slack', '*', '*']);
    });

    it('expands single token to "*:*:name"', () => {
        expect(expandToolPattern('data_get_schema')).toEqual(['*', '*', 'data_get_schema']);
    });

    it('keeps wildcards inside segments', () => {
        expect(expandToolPattern('slack:msg*:send_*')).toEqual(['slack', 'msg*', 'send_*']);
    });

    it('keeps trailing colon segments together when more than 3', () => {
        // Defensive: if someone writes "a:b:c:d", we treat c:d as the tool segment
        expect(expandToolPattern('a:b:c:d')).toEqual(['a', 'b', 'c:d']);
    });
});

describe('isToolDenied', () => {
    it('returns false when denials is undefined', () => {
        expect(isToolDenied('app:coll:tool', undefined)).toBe(false);
    });

    it('returns false when tool denials list is empty or absent', () => {
        expect(isToolDenied('app:coll:tool', {})).toBe(false);
        expect(isToolDenied('app:coll:tool', { tool: [] })).toBe(false);
        expect(isToolDenied('app:coll:tool', { ui: ['x'] })).toBe(false);
    });

    it('matches an exact 3-segment pattern', () => {
        const d: Denials = { tool: ['slack:messaging:send_message'] };
        expect(isToolDenied('slack:messaging:send_message', d)).toBe(true);
        expect(isToolDenied('slack:messaging:other', d)).toBe(false);
    });

    it('matches with wildcard in app segment', () => {
        const d: Denials = { tool: ['*:messaging:send_message'] };
        expect(isToolDenied('slack:messaging:send_message', d)).toBe(true);
        expect(isToolDenied('teams:messaging:send_message', d)).toBe(true);
        expect(isToolDenied('slack:files:send_message', d)).toBe(false);
    });

    it('matches with wildcard in tool segment', () => {
        const d: Denials = { tool: ['slack:messaging:*'] };
        expect(isToolDenied('slack:messaging:send_message', d)).toBe(true);
        expect(isToolDenied('slack:messaging:list_channels', d)).toBe(true);
        expect(isToolDenied('slack:files:upload', d)).toBe(false);
    });

    it('matches app-only pattern (1 colon, expanded to "app:*:*")', () => {
        const d: Denials = { tool: ['slack:*'] };
        expect(isToolDenied('slack:messaging:send_message', d)).toBe(true);
        expect(isToolDenied('slack:files:upload', d)).toBe(true);
        expect(isToolDenied('teams:messaging:send_message', d)).toBe(false);
    });

    it('matches tool-name-only pattern (0 colons, expanded to "*:*:tool")', () => {
        const d: Denials = { tool: ['data_get_schema'] };
        expect(isToolDenied('vertesia-default:data_platform:data_get_schema', d)).toBe(true);
        expect(isToolDenied('any:any:data_get_schema', d)).toBe(true);
        expect(isToolDenied('any:any:data_set_schema', d)).toBe(false);
    });

    it('matches tool-name prefix wildcard', () => {
        const d: Denials = { tool: ['data_*'] };
        expect(isToolDenied('app:coll:data_get_schema', d)).toBe(true);
        expect(isToolDenied('app:coll:data_import', d)).toBe(true);
        expect(isToolDenied('app:coll:get_data', d)).toBe(false);
    });

    it('matches with multiple patterns (OR semantics)', () => {
        const d: Denials = { tool: ['slack:*', 'data_*'] };
        expect(isToolDenied('slack:messaging:send_message', d)).toBe(true);   // first
        expect(isToolDenied('app:coll:data_get', d)).toBe(true);              // second
        expect(isToolDenied('app:coll:other', d)).toBe(false);                // neither
    });

    it('returns false for malformed 3-segment URI', () => {
        const d: Denials = { tool: ['*'] };
        expect(isToolDenied('only-one-segment', d)).toBe(false);
        expect(isToolDenied('two:segments', d)).toBe(false);
    });

    it('handles wildcard within a segment (prefix/suffix/middle)', () => {
        const d: Denials = { tool: ['slack:mes*:*'] };
        expect(isToolDenied('slack:messaging:x', d)).toBe(true);
        expect(isToolDenied('slack:meshes:x', d)).toBe(true);
        expect(isToolDenied('slack:files:x', d)).toBe(false);
    });

    it('is case-sensitive', () => {
        const d: Denials = { tool: ['slack:messaging:Send'] };
        expect(isToolDenied('slack:messaging:Send', d)).toBe(true);
        expect(isToolDenied('slack:messaging:send', d)).toBe(false);
    });

    it('handles empty category segment in URI', () => {
        const d: Denials = { tool: ['app::tool'] };
        expect(isToolDenied('app::tool', d)).toBe(true);
        expect(isToolDenied('app:coll:tool', d)).toBe(false);
    });
});

describe('isUiDenied', () => {
    it('returns false when denials is undefined', () => {
        expect(isUiDenied('slack', undefined)).toBe(false);
    });

    it('returns false when ui denials list is empty or absent', () => {
        expect(isUiDenied('slack', {})).toBe(false);
        expect(isUiDenied('slack', { ui: [] })).toBe(false);
        expect(isUiDenied('slack', { tool: ['x'] })).toBe(false);
    });

    it('matches exact app names', () => {
        const d: Denials = { ui: ['slack'] };
        expect(isUiDenied('slack', d)).toBe(true);
        expect(isUiDenied('teams', d)).toBe(false);
    });

    it('matches wildcard patterns', () => {
        const d: Denials = { ui: ['admin-*'] };
        expect(isUiDenied('admin-tools', d)).toBe(true);
        expect(isUiDenied('admin-users', d)).toBe(true);
        expect(isUiDenied('user-portal', d)).toBe(false);
    });

    it('matches the global wildcard', () => {
        const d: Denials = { ui: ['*'] };
        expect(isUiDenied('anything', d)).toBe(true);
        expect(isUiDenied('slack', d)).toBe(true);
    });

    it('matches with multiple patterns (OR semantics)', () => {
        const d: Denials = { ui: ['slack', 'teams-*'] };
        expect(isUiDenied('slack', d)).toBe(true);
        expect(isUiDenied('teams-bot', d)).toBe(true);
        expect(isUiDenied('discord', d)).toBe(false);
    });

    it('is case-sensitive', () => {
        const d: Denials = { ui: ['Slack'] };
        expect(isUiDenied('Slack', d)).toBe(true);
        expect(isUiDenied('slack', d)).toBe(false);
    });
});

describe('filterDeniedTools', () => {
    const tools = [
        { app_name: 'slack', category: 'messaging', name: 'send_message' },
        { app_name: 'slack', category: 'messaging', name: 'list_channels' },
        { app_name: 'slack', category: 'files', name: 'upload' },
        { app_name: 'teams', category: 'messaging', name: 'send_message' },
        { app_name: 'vertesia-default', category: 'data_platform', name: 'data_get_schema' },
    ];

    it('returns the array unchanged when denials is empty', () => {
        expect(filterDeniedTools(tools, undefined)).toEqual(tools);
        expect(filterDeniedTools(tools, {})).toEqual(tools);
        expect(filterDeniedTools(tools, { tool: [] })).toEqual(tools);
    });

    it('filters by exact tool URI', () => {
        const result = filterDeniedTools(tools, { tool: ['slack:messaging:send_message'] });
        expect(result.map(t => t.name)).toEqual(['list_channels', 'upload', 'send_message', 'data_get_schema']);
    });

    it('filters whole app via "app:*" pattern', () => {
        const result = filterDeniedTools(tools, { tool: ['slack:*'] });
        expect(result.map(t => t.app_name)).toEqual(['teams', 'vertesia-default']);
    });

    it('filters by tool-name-only pattern', () => {
        const result = filterDeniedTools(tools, { tool: ['send_message'] });
        expect(result.map(t => t.name)).toEqual(['list_channels', 'upload', 'data_get_schema']);
    });

    it('filters by prefix wildcard on tool name', () => {
        const result = filterDeniedTools(tools, { tool: ['data_*'] });
        expect(result.find(t => t.name === 'data_get_schema')).toBeUndefined();
        expect(result.length).toBe(4);
    });

    it('handles tools without a category', () => {
        const minimal = [
            { app_name: 'app', name: 'thing' },                       // no category
            { app_name: 'app', category: 'coll', name: 'thing' },     // with category
        ];
        const result = filterDeniedTools(minimal, { tool: ['app::thing'] });
        expect(result.length).toBe(1);
        expect(result[0].category).toBe('coll');
    });
});

describe('DenialsMatcher', () => {
    it('handles undefined denials', () => {
        const m = new DenialsMatcher(undefined);
        expect(m.hasToolDenials).toBe(false);
        expect(m.hasUiDenials).toBe(false);
        expect(m.isToolDenied('app', 'coll', 'tool')).toBe(false);
        expect(m.isUiDenied('app')).toBe(false);
    });

    it('handles empty denial lists', () => {
        const m = new DenialsMatcher({ tool: [], ui: [] });
        expect(m.hasToolDenials).toBe(false);
        expect(m.hasUiDenials).toBe(false);
    });

    it('matches tool denials with parts overload', () => {
        const m = new DenialsMatcher({ tool: ['slack:*'] });
        expect(m.isToolDenied('slack', 'messaging', 'send')).toBe(true);
        expect(m.isToolDenied('teams', 'messaging', 'send')).toBe(false);
    });

    it('matches tool denials with URI overload', () => {
        const m = new DenialsMatcher({ tool: ['data_*'] });
        expect(m.isToolUriDenied('app:coll:data_get_schema')).toBe(true);
        expect(m.isToolUriDenied('app:coll:other')).toBe(false);
        // malformed URI
        expect(m.isToolUriDenied('only-one')).toBe(false);
        expect(m.isToolUriDenied('two:segments')).toBe(false);
    });

    it('matches UI denials', () => {
        const m = new DenialsMatcher({ ui: ['admin-*', 'slack'] });
        expect(m.isUiDenied('slack')).toBe(true);
        expect(m.isUiDenied('admin-tools')).toBe(true);
        expect(m.isUiDenied('discord')).toBe(false);
    });

    it('filters tools', () => {
        const m = new DenialsMatcher({ tool: ['slack:*'] });
        const tools = [
            { app_name: 'slack', category: 'a', name: 'x' },
            { app_name: 'teams', category: 'a', name: 'x' },
        ];
        expect(m.filterTools(tools)).toEqual([{ app_name: 'teams', category: 'a', name: 'x' }]);
    });

    it('compiles patterns lazily and reuses them across calls', () => {
        // Spy on RegExp construction by counting via a side-effect-free check:
        // a second call shouldn't re-allocate compiled state. We can't easily
        // assert on regex construction directly, but we can confirm the
        // matcher produces consistent results across many calls efficiently.
        const m = new DenialsMatcher({ tool: ['app:*:tool_*', '*:cat:*'] });
        for (let i = 0; i < 1000; i++) {
            expect(m.isToolDenied('app', 'whatever', 'tool_x')).toBe(true);
            expect(m.isToolDenied('other', 'cat', 'anything')).toBe(true);
            expect(m.isToolDenied('other', 'nomatch', 'tool_x')).toBe(false);
        }
    });

    it('handles tools without category (treated as empty segment)', () => {
        const m = new DenialsMatcher({ tool: ['app::thing'] });
        expect(m.isToolDenied('app', undefined, 'thing')).toBe(true);
        expect(m.isToolDenied('app', 'coll', 'thing')).toBe(false);
    });

    it('parts overload is consistent with URI overload', () => {
        const m = new DenialsMatcher({ tool: ['slack:messaging:send_*'] });
        for (const tool of ['send_message', 'send_file', 'send_invite']) {
            const partsResult = m.isToolDenied('slack', 'messaging', tool);
            const uriResult = m.isToolUriDenied(`slack:messaging:${tool}`);
            expect(partsResult).toBe(uriResult);
            expect(partsResult).toBe(true);
        }
    });
});

describe('DenialsMatcher — app: kind', () => {
    it('hasAppDenials reflects presence of patterns', () => {
        expect(new DenialsMatcher(undefined).hasAppDenials).toBe(false);
        expect(new DenialsMatcher({}).hasAppDenials).toBe(false);
        expect(new DenialsMatcher({ app: [] }).hasAppDenials).toBe(false);
        expect(new DenialsMatcher({ app: ['slack'] }).hasAppDenials).toBe(true);
    });

    it('isAppDenied matches only app: patterns, not ui or tool', () => {
        const m = new DenialsMatcher({ app: ['slack'], ui: ['teams'], tool: ['github:*'] });
        expect(m.isAppDenied('slack')).toBe(true);
        expect(m.isAppDenied('teams')).toBe(false);     // ui: doesn't make isAppDenied true
        expect(m.isAppDenied('github')).toBe(false);    // tool: doesn't make isAppDenied true
        expect(m.isAppDenied('other')).toBe(false);
    });

    it('isAppDenied supports wildcards', () => {
        const m = new DenialsMatcher({ app: ['admin-*'] });
        expect(m.isAppDenied('admin-tools')).toBe(true);
        expect(m.isAppDenied('admin-users')).toBe(true);
        expect(m.isAppDenied('public-app')).toBe(false);
    });

    it('isUiDenied checks app: as well as ui:', () => {
        const m = new DenialsMatcher({ app: ['slack'] });
        expect(m.isUiDenied('slack')).toBe(true);     // covered by app:
        expect(m.isUiDenied('teams')).toBe(false);
    });

    it('isToolDenied checks app: as well as tool:', () => {
        const m = new DenialsMatcher({ app: ['slack'] });
        expect(m.isToolDenied('slack', 'messaging', 'send')).toBe(true);
        expect(m.isToolDenied('slack', 'any', 'any')).toBe(true);
        expect(m.isToolDenied('teams', 'messaging', 'send')).toBe(false);
    });

    it('combines ui:, tool:, and app: with OR semantics', () => {
        const m = new DenialsMatcher({
            ui: ['admin-portal'],
            tool: ['github:files:upload'],
            app: ['slack'],
        });
        // app entirely denied
        expect(m.isUiDenied('slack')).toBe(true);
        expect(m.isToolDenied('slack', 'msg', 'x')).toBe(true);
        // ui-only deny
        expect(m.isUiDenied('admin-portal')).toBe(true);
        expect(m.isAppDenied('admin-portal')).toBe(false);
        // tool-only deny
        expect(m.isToolDenied('github', 'files', 'upload')).toBe(true);
        expect(m.isUiDenied('github')).toBe(false);     // github's UI still visible
        expect(m.isAppDenied('github')).toBe(false);
    });

    it('filterTools honors app: denials', () => {
        const m = new DenialsMatcher({ app: ['slack'] });
        const tools = [
            { app_name: 'slack', category: 'msg', name: 'send' },
            { app_name: 'slack', category: 'files', name: 'upload' },
            { app_name: 'teams', category: 'msg', name: 'send' },
        ];
        expect(m.filterTools(tools).map(t => t.app_name)).toEqual(['teams']);
    });

    it('isUiDenied with both ui: and app: triggers if either matches', () => {
        const m = new DenialsMatcher({ ui: ['ui-only'], app: ['app-wide'] });
        expect(m.isUiDenied('ui-only')).toBe(true);
        expect(m.isUiDenied('app-wide')).toBe(true);
        expect(m.isUiDenied('other')).toBe(false);
    });
});
