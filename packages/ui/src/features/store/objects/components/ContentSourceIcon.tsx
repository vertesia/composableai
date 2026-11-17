import { VTooltip } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import type { SVGProps } from 'react';

/** The external systems whose files a content source syncs, by the scheme of `content.source`. */
export type ExternalSourceSystem = 'sharepoint' | 'box';

/** The system a document's `content.source` points to, or undefined for content stored in Vertesia. */
export function externalSourceSystem(source: string | undefined): ExternalSourceSystem | undefined {
    if (!source) return undefined;
    if (source.startsWith('sharepoint://')) return 'sharepoint';
    if (source.startsWith('box://')) return 'box';
    return undefined;
}

// Brand marks keep their own colors, like the sign-in provider icons.
function SharePointMark(props: SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
            <circle cx="12.5" cy="7" r="6" fill="#036C70" />
            <circle cx="17.5" cy="13" r="5" fill="#1A9BA1" />
            <circle cx="13" cy="18.5" r="4" fill="#37C6D0" />
            <rect x="1" y="6" width="12" height="12" rx="2" fill="#03787C" />
            <path
                d="M9.6 9.4c-.5-.5-1.3-.8-2.3-.8-1.3 0-2.2.6-2.2 1.6 0 2.2 4.8 1.3 4.8 3.7 0 1-.9 1.8-2.4 1.8-1.1 0-2-.4-2.6-1"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
        </svg>
    );
}

function BoxMark(props: SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
            <rect x="2" y="2" width="20" height="20" rx="4" fill="#0061D5" />
            <path d="M8 6v11" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="13.5" r="3.5" fill="none" stroke="#FFFFFF" strokeWidth="2" />
        </svg>
    );
}

const MARKS = { sharepoint: SharePointMark, box: BoxMark } as const;

interface ContentSourceIconProps {
    /** The document's `content.source`. */
    source: string | undefined;
    className?: string;
}

/**
 * The mark of the external system a document is synced from (SharePoint, Box), with a tooltip. Renders nothing for a
 * document stored in Vertesia.
 */
export function ContentSourceIcon({ source, className = 'size-4 shrink-0' }: ContentSourceIconProps) {
    const { t } = useUITranslation();
    const system = externalSourceSystem(source);
    if (!system) return null;
    const Mark = MARKS[system];
    const label = system === 'sharepoint' ? t('store.syncedFromSharePoint') : t('store.syncedFromBox');
    return (
        <VTooltip description={label} asChild>
            <span role="img" aria-label={label} className="inline-flex">
                <Mark className={className} />
            </span>
        </VTooltip>
    );
}
