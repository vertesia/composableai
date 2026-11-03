import { describe, expect, it } from 'vitest';
import { parseSkillWidgets, skillWidgetSources } from './skillWidgetSources';

const gateway = 'https://app-gateway-dev-main.api.dev2.vertesia.io';
const appMount = `${gateway}/tenants/429844_42991f/apps/charts`;
const packageSource = { type: 'package', url: `${appMount}/api/package?scope=widgets`, authenticated: true };

describe('skillWidgetSources', () => {
    it('reads gateway app widgets from the package descriptor under the app mount, authenticated', () => {
        const sources = skillWidgetSources(
            [{ endpoint: '{{gateway}}/tenants/429844_42991f/apps/charts', capabilities: ['tools'] }],
            { gateway },
        );
        expect(sources).toEqual([packageSource]);
    });

    it('never authenticates a gateway-shaped endpoint on another origin', () => {
        const sources = skillWidgetSources(
            [{ endpoint: 'https://elsewhere.example.test/tenants/t/apps/a', capabilities: ['tools'] }],
            { gateway },
        );
        expect(sources).toEqual([
            {
                type: 'package',
                url: 'https://elsewhere.example.test/tenants/t/apps/a/api/package?scope=widgets',
                authenticated: false,
            },
        ]);
    });

    it('keeps /api/widgets next to the package endpoint of other tool servers', () => {
        expect(
            skillWidgetSources([
                { endpoint: 'https://tools.example.test/api/package', capabilities: ['tools'] },
                { endpoint: 'https://host.example.test/team/api/package', capabilities: ['tools'] },
            ]),
        ).toEqual([
            { type: 'widgets', url: 'https://tools.example.test/api/widgets' },
            { type: 'widgets', url: 'https://host.example.test/team/api/widgets' },
        ]);
    });

    it('derives sources from tool collection URLs and de-duplicates them', () => {
        expect(
            skillWidgetSources(
                [
                    {
                        endpoint: 'https://tools.example.test/api/package',
                        capabilities: ['tools'],
                        tool_collections: [{ type: 'vertesia_sdk', url: 'https://tools.example.test/api/tools/main' }],
                    },
                    {
                        endpoint: '{{gateway}}/tenants/429844_42991f/apps/charts',
                        capabilities: ['tools'],
                        tool_collections: [
                            {
                                type: 'vertesia_sdk',
                                url: '{{gateway}}/tenants/429844_42991f/apps/charts/api/tools/main',
                            },
                        ],
                    },
                ],
                { gateway },
            ),
        ).toEqual([{ type: 'widgets', url: 'https://tools.example.test/api/widgets' }, packageSource]);
    });

    it('skips apps without the tools capability and endpoints it cannot resolve', () => {
        expect(
            skillWidgetSources([
                { endpoint: 'https://ui-only.example.test/api/package', capabilities: ['ui'] },
                { endpoint: '{{gateway}}/tenants/t/apps/a', capabilities: ['tools'] },
            ]),
        ).toEqual([]);
    });
});

describe('parseSkillWidgets', () => {
    it('resolves root-relative package widget URLs against the gateway origin', () => {
        const widgets = parseSkillWidgets(
            { widgets: { 'bar-chart': { url: '/tenants/429844_42991f/apps/charts/widgets/bar-chart.js' } } },
            `${appMount}/api/package?scope=widgets`,
        );
        expect(widgets).toEqual({ 'bar-chart': `${appMount}/widgets/bar-chart.js` });
    });

    it('keeps absolute widget URLs and ignores malformed entries', () => {
        const widgets = parseSkillWidgets(
            {
                widgets: {
                    map: { url: 'https://tools.example.test/widgets/map.js' },
                    broken: {},
                },
            },
            'https://tools.example.test/api/widgets',
        );
        expect(widgets).toEqual({ map: 'https://tools.example.test/widgets/map.js' });
        expect(parseSkillWidgets({}, 'https://tools.example.test/api/widgets')).toEqual({});
    });
});
