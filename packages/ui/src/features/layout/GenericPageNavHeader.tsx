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

// Matches MongoDB ObjectId (24 hex), UUID (36 chars with dashes), or any segment containing digits mixed with letters
const ID_SEGMENT_PATTERN = /^[a-f0-9]{24}$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$|^(?=.*\d)(?=.*[a-zA-Z])[a-zA-Z0-9_-]{8,}$/i;

function isIdSegment(segment: string): boolean {
    return ID_SEGMENT_PATTERN.test(segment);
}

export function GenericPageNavHeader({ className, children, title, description, actions, breadcrumbs, useDynamicBreadcrumbs = true }: GenericPageNavHeaderProps) {
    const navigate = useNavigate();

    function formatTitle(title: string): string {
        return title
            .replace(/[-_]/g, ' ')
            .split(' ')
            .map(word => capitalize(word))
            .join(' ');
    }

    const buildBreadcrumbLabel = (entry: any): string => {
        if (entry?.title) {
            return entry.title;
        }

        const href = entry?.href || '';
        if (!href) return 'Page';

        const cleanHref = href.split('#')[0].split('?')[0];
        const pathSegments: string[] = (cleanHref as string).split('/').filter((segment: string) => segment.length > 0);

        if (pathSegments.length >= 1) {
            return formatTitle(pathSegments[pathSegments.length - 1]);
        }

        return 'Page';
    }

    // Build breadcrumb items from history chain and current breadcrumbs
    const buildBreadcrumbItems = (): Array<{ label: string | ReactNode, href?: string, onClick?: () => void }> => {
        const items: Array<{ label: string | ReactNode, href?: string, onClick?: () => void, clearHistory?: boolean }> = [];

        if (useDynamicBreadcrumbs && typeof window !== 'undefined') {
            const historyChain = window.history.state?.historyChain;

            if (historyChain) {
                // Use existing history chain
                historyChain.forEach((entry: any, index: number) => {
                    const stepsBack = historyChain.length - index;
                    items.push({
                        label: buildBreadcrumbLabel(entry),
                        href: entry.href,
                        onClick: () => navigate(entry.href, { stepsBack: stepsBack })
                    });
                });
            } else {
                // Infer parents from URL when navigating directly to a detail page
                const segments = window.location.pathname.split('/').filter(s => s.length > 0);
                for (let i = 0; i < segments.length; i++) {
                    if (isIdSegment(segments[i])) {
                        const parentPath = '/' + segments.slice(0, i).join('/');
                        items.push({
                            label: formatTitle(segments[i - 1] || parentPath),
                            href: parentPath,
                            onClick: () => navigate(parentPath, { isBasePathNested: false}),
                        });
                    }
                }
            }
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
        <div className={clsx('pb-0 pl-4 pr-2 py-2 flex flex-col', className)}>
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
                        {
                            description &&
                            <VTooltip
                                description={description}>
                                <Info className="size-4 text-muted ml-4" />
                            </VTooltip>
                        }
                    </nav>
                    {
                        title && (
                            <div className='flex gap-2 items-center'>
                                <h1 className="text-xl font-semibold break-all">{title}</h1>

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