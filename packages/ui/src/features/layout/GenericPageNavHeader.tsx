import clsx from 'clsx';
import { JSX, ReactNode } from 'react';

import { ChevronRight, Info } from 'lucide-react';
import { VTooltip, Breadcrumbs } from '@vertesia/ui/core';
import { capitalize } from 'lodash-es';
import { useNavigate } from '@vertesia/ui/router';

interface GenericPageNavHeaderProps {
    title?: string | JSX.Element;
    description?: string | JSX.Element;
    actions?: ReactNode | ReactNode[];
    breadcrumbs?: JSX.Element[]
    isCompact?: boolean
    children?: ReactNode
    className?: string
    useDynamicBreadcrumbs?: boolean;
}

export function GenericPageNavHeader({ className, children, title, description, actions, breadcrumbs, isCompact = false, useDynamicBreadcrumbs = true }: GenericPageNavHeaderProps) {
    const navigate = useNavigate();

    function formatTitle(title: string): string {
        return title
            .replace(/[-_]/g, ' ')
            .split(' ')
            .map(word => capitalize(word))
            .join(' ');
    }

    const buildBreadcrumbLabel = (entry: any): string => {
        const href = entry?.href || '';
        if (!href) return 'Page';

        const cleanHref = href.split('#')[0].split('?')[0];
        const pathSegments: string[] = (cleanHref as string).split('/').filter((segment: string) => segment.length > 0);

        if (pathSegments.length === 3) {
            if (entry.title !== document.title && entry.title) {
                return entry.title;
            }
            const secondSegment = pathSegments[1];
            return `${formatTitle(secondSegment)} Detail (...${pathSegments[2].slice(-6)})`;
        } else if (pathSegments.length >= 2) {
            return formatTitle(pathSegments[pathSegments.length - 1]);
        } else if (pathSegments.length === 1) {
            return formatTitle(pathSegments[0]);
        }

        return 'Page';
    }

    // Build breadcrumb items from history chain and current breadcrumbs
    const buildBreadcrumbItems = (): Array<{ label: string | ReactNode, href?: string, onClick?: () => void }> => {
        const items: Array<{ label: string | ReactNode, href?: string, onClick?: () => void, clearHistory?: boolean }> = [];

        // Add items from history chain
        if (useDynamicBreadcrumbs && typeof window !== 'undefined' && window.history.state?.historyChain) {
            const historyChain = window.history.state.historyChain;
            historyChain.forEach((entry: any, index: number) => {
                const stepsBack = historyChain.length - index;
                items.push({
                    label: buildBreadcrumbLabel(entry),
                    href: entry.href,
                    onClick: () => navigate(entry.href, { stepsBack: stepsBack })
                });
            });
        }

        // Add current page breadcrumbs
        if (breadcrumbs && breadcrumbs.length > 0) {
            breadcrumbs.forEach((breadcrumb: any) => {
                // Preserve the entire React element as label
                const label = breadcrumb.props?.children || breadcrumb;

                items.push((breadcrumb?.props?.href) ? {
                    href: breadcrumb?.props?.href,
                    label: label,
                    onClick: () => navigate(breadcrumb.props.href, { replace: breadcrumb.props.clearBreadcrumbs }),
                } : {
                    label: label
                });
            });
        }

        return items;
    };

    const breadcrumbItems = buildBreadcrumbItems();

    return (
        <div className={clsx(isCompact ? 'pb-0' : 'pb-2', 'px-4 py-2 flex flex-col', className)}>
            <div className='flex items-start gap-4'>
                <div className="w-full flex place-content-between h-auto min-h-8 flex-col items-start justify-center">
                    <nav className="flex-1 flex justify-start text-sm">
                        {breadcrumbItems.length > 0 && (
                            <Breadcrumbs
                                path={breadcrumbItems}
                                separator={<ChevronRight className="size-3.5" />}
                                maxItems={4}
                            />
                        )}
                    </nav>
                    {
                        title && (
                            <div className='flex gap-2 items-center'>
                                <h1 className="text-xl font-semibold break-all">{title}</h1>
                                {
                                    description &&
                                    <VTooltip
                                        description={description}>
                                        <Info className="size-4 text-muted" />
                                    </VTooltip>
                                }
                            </div>

                        )
                    }
                </div>
                <div className="flex gap-x-2 shrink-0">{actions}</div>
            </div>
            {children && <div className="w-full flex items-center">{children}</div>}
        </div>
    )
}