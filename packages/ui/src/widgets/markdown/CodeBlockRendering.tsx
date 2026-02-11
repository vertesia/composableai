import { createContext, useContext, useMemo } from "react";

export interface CodeBlockRendererProps {
    code: string;
    language?: string;
}
export class CodeBlockRendererRegistry {
    components: Record<string, React.FunctionComponent<any>> = {};

    registerComponent(language: string, component: React.FunctionComponent<CodeBlockRendererProps>) {
        this.components[language] = component;
    }

    getComponent(language: string): React.FunctionComponent<CodeBlockRendererProps> | undefined {
        return this.components[language];
    }

}

const Context = createContext<CodeBlockRendererRegistry | null>(null);

interface CodeBlockRendererProviderProps {
    components: Record<string, React.FunctionComponent<CodeBlockRendererProps>>;
    children: React.ReactNode;
}
/**
 * the compoennts must be memoized to avoid rerendering the provider unnecessarily
 * @param param0
 * @returns
 */
export function CodeBlockRendererProvider({ components, children }: CodeBlockRendererProviderProps) {
    const registry = useMemo(() => {
        const registry = new CodeBlockRendererRegistry();
        for (const [language, component] of Object.entries(components)) {
            registry.registerComponent(language, component);
        }
        return registry;
    }, [components]);

    return (
        <>
            <Context.Provider value={registry}>{children}</Context.Provider>
        </>
    )
}

export function useCodeBlockRendererRegistry() {
    return useContext(Context);
}

export function useCodeBlockComponent(language: string) {
    const registry = useContext(Context);
    if (registry) {
        return registry.getComponent(language);
    }
    return undefined;
}
