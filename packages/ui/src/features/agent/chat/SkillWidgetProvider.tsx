import { VertesiaClient } from "@vertesia/client";
import { normalizeToolCollection } from "@vertesia/common";
import { useUserSession } from "@vertesia/ui/session";
import { CodeBlockRendererProps, CodeBlockRendererProvider } from "@vertesia/ui/widgets";
import { memo, useEffect, useMemo, useState } from "react";
import { AgentChart, AgentChartSpec } from "./AgentChart";
import { VegaLiteChart } from "./VegaLiteChart";

interface SkillWidgetProviderProperties {
    children: React.ReactNode;
}

/**
 * Widget for rendering Recharts-based charts (bar, line, pie, etc.)
 * Used for `chart` code blocks that use Recharts format
 */
const RechartsChartWidget = memo(function RechartsChartWidget({ code }: { code: string }) {
    const spec = useMemo(() => {
        try {
            return JSON.parse(code) as AgentChartSpec;
        } catch {
            // During streaming, code may be incomplete JSON - return null to skip rendering
            return null;
        }
    }, [code]);

    // Don't render anything while JSON is incomplete (during streaming)
    if (!spec) {
        return null;
    }

    return <AgentChart spec={spec} />
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
    return <VegaLiteChart spec={spec} />
});

const defaultComponents: Record<string, React.FunctionComponent<CodeBlockRendererProps>> = {
    "chart": RechartsChartWidget,
    "vega-lite": VegaLiteChartWidget,
    "vegalite": VegaLiteChartWidget,
}

function RemoteWidgetComponent({ url, code }: { url: string, code: string }) {
    const [Component, setComponent] = useState<React.FunctionComponent<{ code: string }> | null>(null);
    useEffect(() => {
        import(/* @vite-ignore */url).then(module => {
            // register the component
            // Wrap in arrow function to prevent React from calling it as a state updater
            setComponent(() => module.default)
        }).catch(err => {
            console.error("Failed to load remote widget component from ", url, err);
        })
    }, [url]);
    return Component ? <Component code={code} /> : null;
}

async function fetchSkillWidgets(client: VertesiaClient): Promise<Record<string, React.FunctionComponent<CodeBlockRendererProps>>> {
    const installedApps = await client.apps.getInstalledApps("tools");
    const urls = new Set<string>();
    for (const app of installedApps) {
        for (const item of app.manifest.tool_collections || []) {
            const collection = normalizeToolCollection(item);
            const collUrl = collection.url;
            if (collUrl.startsWith("http://") || collUrl.startsWith("https://")) {
                const i = collUrl.indexOf("/api/");
                if (i > 0) {
                    const url = collUrl.substring(0, i);
                    urls.add(url + '/api/widgets');
                }
            }
        }
    }

    const allWidgets = await Promise.all(Array.from(urls).map(url => {
        return fetch(url).then(r => {
            if (!r.ok) {
                throw new Error(`Failed to fetch widgets: ${r.status} ${r.statusText}`);
            }
            return r.json();
        }).then(data => {
            const widgets: { name: string, component: React.FunctionComponent<CodeBlockRendererProps> }[] = [];
            const widgetsMap = data.widgets as Record<string, { url: string }>;
            for (const [name, value] of Object.entries(widgetsMap)) {
                widgets.push({ name, component: (props: CodeBlockRendererProps) => <RemoteWidgetComponent url={value.url} code={props.code} /> });
            }
            return widgets;
        }).catch(() => {
            console.error("Failed to fetch skill widgets from ", url);
            return null
        });
    }));

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
    const [components, setComponents] = useState<Record<string, React.FunctionComponent<CodeBlockRendererProps>>>(defaultComponents);
    useEffect(() => {
        // fetch all skill components
        fetchSkillWidgets(client).then(widgets => {
            setComponents({
                ...defaultComponents,
                ...widgets,
            })
        })
    }, []);


    return (
        <CodeBlockRendererProvider components={components}>{children}</CodeBlockRendererProvider>
    )

}
