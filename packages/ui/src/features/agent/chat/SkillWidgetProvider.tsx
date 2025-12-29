import { VertesiaClient } from "@vertesia/client";
import { useUserSession } from "@vertesia/ui/session";
import { CodeBlockRendererProps, CodeBlockRendererProvider } from "@vertesia/ui/widgets";
import { useEffect, useMemo, useState } from "react";
import { AgentChart, AgentChartSpec } from "./AgentChart";

interface SkillWidgetProviderProperties {
    children: React.ReactNode;
}

const AgentChartWidget = ({ code }: { code: string }) => {
    const spec = useMemo(() => {
        return JSON.parse(code) as AgentChartSpec;
    }, [code]);
    return <AgentChart spec={spec} />
}

const defaultComponents: Record<string, React.FunctionComponent<CodeBlockRendererProps>> = {
    "chart": AgentChartWidget
}

function RemoteWidgetComponent({ url, code }: { url: string, code: string }) {
    const [Component, setComponent] = useState<React.FunctionComponent<{ code: string }> | null>(null);
    useEffect(() => {
        import(url).then(module => {
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
        for (const collUrl of app.manifest.tool_collections || []) {
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
