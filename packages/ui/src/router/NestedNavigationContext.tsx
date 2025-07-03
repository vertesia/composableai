import React from "react";
import { FixLinks } from "./FixLinks";
import { NavigateOptions } from "./HistoryNavigator";
import { RouteComponent } from "./RouteComponent";
import { ReactRouterContext, useRouterContext } from "./Router";
import { joinPath } from "./path";


interface NestedNavigationContextProps {
    basePath: string;
    fixLinks?: boolean;
    children: React.ReactNode | React.ReactNode[];
}
export function NestedNavigationContext({ basePath, fixLinks = false, children }: NestedNavigationContextProps) {
    const ctx = useRouterContext();

    const wrapWithFixLinks = fixLinks ?
        (elem: any) => <FixLinks basePath={ctx.matchedRoutePath}>{elem}</FixLinks>
        : (elem: any) => elem;

    return (
        <ReactRouterContext.Provider value={{
            ...ctx,
            navigate: (to: string, options?: NavigateOptions) => {
                const actualBasePath = options?.basePath ? joinPath(basePath, options.basePath) : basePath;
                return ctx.navigate(to, { ...options, basePath: actualBasePath });
            }
        }}>
            {wrapWithFixLinks(children ? children : <RouteComponent />)}
        </ReactRouterContext.Provider>
    )
}
