import type { VertesiaClient } from '@vertesia/client';
import { FusionFragmentHandler } from '@vertesia/fusion-ux';
import { Env } from '@vertesia/ui/env';
import { useUserSession } from '@vertesia/ui/session';
import { type CodeBlockRendererProps, CodeBlockRendererProvider } from '@vertesia/ui/widgets';
import { memo, useEffect, useMemo, useState } from 'react';
import type { VegaLiteChartSpec } from './AgentChart';
import { ProposalCodeBlockHandler } from './ProposalCodeBlockHandler';
import { parseSkillWidgets, type SkillWidgetSource, skillWidgetSources } from './skillWidgetSources';
import { VegaLiteChart } from './VegaLiteChart';

interface SkillWidgetProviderProperties {
    children: React.ReactNode;
}

/**
 * Widget for rendering chart code blocks.
 * `chart` and `vega-lite` now both render through Vega-Lite.
 */
const ChartWidget = memo(function ChartWidget({ code }: { code: string }) {
    const spec = useMemo(() => {
        try {
            const parsed = JSON.parse(code);

            // Wrapped Vega-Lite format
            if (parsed?.library === 'vega-lite' && parsed?.spec && typeof parsed.spec === 'object') {
                return parsed as VegaLiteChartSpec;
            }

            // Native Vega-Lite spec format
            if (typeof parsed?.$schema === 'string' && parsed.$schema.includes('vega')) {
                return { library: 'vega-lite' as const, spec: parsed };
            }

            return null;
        } catch {
            // During streaming, code may be incomplete JSON - return null to skip rendering
            return null;
        }
    }, [code]);

    // Don't render anything while JSON is incomplete (during streaming)
    if (!spec) {
        return null;
    }

    return <VegaLiteChart spec={spec} />;
});

/**
 * Widget for rendering Vega-Lite charts directly
 * Used for `vega-lite` and `vegalite` code blocks
 */
const VegaLiteChartWidget = memo(function VegaLiteChartWidget({ code }: { code: string }) {
    const spec = useMemo(() => {
        try {
            const parsed = JSON.parse(code);
            // Wrap native Vega-Lite spec in the expected format
            return { library: 'vega-lite' as const, spec: parsed };
        } catch {
            // During streaming, code may be incomplete JSON - return null to skip rendering
            return null;
        }
    }, [code]);

    // Don't render anything while JSON is incomplete (during streaming)
    if (!spec) {
        return null;
    }

    // Render VegaLiteChart directly - bypass AgentChart routing
    return <VegaLiteChart spec={spec} />;
});

const defaultComponents: Record<string, React.FunctionComponent<CodeBlockRendererProps>> = {
    chart: ChartWidget,
    'vega-lite': VegaLiteChartWidget,
    vegalite: VegaLiteChartWidget,
    'fusion-fragment': FusionFragmentHandler,
    proposal: ProposalCodeBlockHandler,
    askuser: ProposalCodeBlockHandler,
};

function RemoteWidgetComponent({ url, code }: { url: string; code: string }) {
    const [Component, setComponent] = useState<React.FunctionComponent<{ code: string }> | null>(null);
    useEffect(() => {
        import(/* @vite-ignore */ url)
            .then((module) => {
                // register the component
                // Wrap in arrow function to prevent React from calling it as a state updater
                setComponent(() => module.default);
            })
            .catch((err) => {
                console.error('Failed to load remote widget component from ', url, err);
            });
    }, [url]);
    return Component ? <Component code={code} /> : null;
}

async function loadSkillWidgets(client: VertesiaClient, source: SkillWidgetSource): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};
    if (source.type === 'package' && source.authenticated) {
        const jwt = await client.getRawJWT();
        if (jwt) headers.Authorization = `Bearer ${jwt}`;
    }
    const r = await fetch(source.url, { headers });
    // Most tool servers define no widgets. A gateway package always exists, so its 404 is a real failure.
    if (r.status === 404 && source.type === 'widgets') return {};
    if (!r.ok) {
        throw new Error(`Failed to fetch widgets: ${r.status} ${r.statusText}`);
    }
    return parseSkillWidgets(await r.json(), source.url);
}

async function fetchSkillWidgets(
    client: VertesiaClient,
): Promise<Record<string, React.FunctionComponent<CodeBlockRendererProps>>> {
    const installedApps = await client.apps.getInstalledApps('tools');
    const sources = skillWidgetSources(
        installedApps.map((app) => app.manifest),
        { gateway: Env.endpoints.gateway },
    );

    const allWidgets = await Promise.all(
        sources.map((source) => {
            return loadSkillWidgets(client, source)
                .then((widgetUrls) =>
                    Object.entries(widgetUrls).map(([name, widgetUrl]) => ({
                        name,
                        component: (props: CodeBlockRendererProps) => (
                            <RemoteWidgetComponent url={widgetUrl} code={props.code} />
                        ),
                    })),
                )
                .catch((err: unknown) => {
                    // The chat still renders; only that app's custom widgets are missing.
                    console.warn('Failed to fetch skill widgets from', source.url, err);
                    return null;
                });
        }),
    );

    const widgets: Record<string, React.FunctionComponent<CodeBlockRendererProps>> = {};

    for (const widgetSpec of allWidgets.flat()) {
        if (widgetSpec) {
            widgets[widgetSpec.name] = widgetSpec.component;
        }
    }
    return widgets;
}

/**
 * Provides code block components depending on lagauge form the installed skills
 * @param param0
 * @returns
 */
export function SkillWidgetProvider({ children }: SkillWidgetProviderProperties) {
    const { client } = useUserSession();
    const [components, setComponents] =
        useState<Record<string, React.FunctionComponent<CodeBlockRendererProps>>>(defaultComponents);
    useEffect(() => {
        // fetch all skill components
        void fetchSkillWidgets(client).then((widgets) => {
            setComponents({
                ...defaultComponents,
                ...widgets,
            });
        });
    }, [client]);

    return <CodeBlockRendererProvider components={components}>{children}</CodeBlockRendererProvider>;
}
