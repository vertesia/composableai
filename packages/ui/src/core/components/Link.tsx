import React from "react";
import clsx from "clsx";

interface LinkProps extends React.HTMLProps<HTMLAnchorElement> {
    underline?: 'always' | 'hover' | 'none'
}
export function Link({ underline = 'always', className, children, ...others }: LinkProps) {

    let underlineClass: string | undefined;
    if (underline === 'always') {
        underlineClass = 'underline';
    } else if (underline === 'hover') {
        underlineClass = 'hover:underline';
    }
    return <a className={clsx("text-indigo-800 dark:text-indigo-300", className, underlineClass)} {...others}>{children}</a>
}
