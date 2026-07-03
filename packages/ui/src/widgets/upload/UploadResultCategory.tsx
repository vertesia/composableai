import { useUITranslation } from '@vertesia/ui/i18n';
import { CheckCircleIcon } from 'lucide-react';
import { useId, useState } from 'react';

/**
 * Props for the UploadResultCategory component
 */
export interface UploadResultCategoryProps {
    /** Category title */
    title: string;
    /** Number of items in this category */
    count: number;
    /** Icon to display next to the title */
    icon?: React.ReactNode;
    /** List of items to display */
    items: string[];
}

/**
 * Displays a collapsible category of upload results
 *
 * @example
 * <UploadResultCategory
 *   title="Successfully Uploaded"
 *   count={3}
 *   icon={<CheckCircleIcon className="h-4 w-4 text-green-500" />}
 *   items={["document1.pdf", "document2.pdf", "document3.pdf"]}
 * />
 */
export function UploadResultCategory({
    title,
    count,
    icon = <CheckCircleIcon className="h-4 w-4 text-green-500" />,
    items,
}: UploadResultCategoryProps) {
    const { t } = useUITranslation();
    const [isExpanded, setIsExpanded] = useState(false);
    const panelId = useId();

    return (
        <div className="border border-color-border rounded-md overflow-hidden">
            {/* The header IS the toggle: a real <button> with aria-expanded/aria-controls so
                keyboard users can operate it (Enter / Space) and screen readers announce state. */}
            <button
                type="button"
                aria-expanded={isExpanded}
                aria-controls={panelId}
                className="w-full flex items-center justify-between p-3 bg-color-muted/10 cursor-pointer text-start bg-transparent border-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <span className="flex items-center">
                    <span className="me-2">{icon}</span>
                    <span className="font-medium">{title}</span>
                    <span className="ms-2 px-2 py-0.5 bg-color-muted/20 rounded-full text-xs">{count}</span>
                </span>
                <span className="text-muted" aria-hidden="true">
                    <svg
                        className={`h-5 w-5 transition-transform ${isExpanded ? 'transform rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </span>
            </button>

            {isExpanded && (
                <div id={panelId} className="p-3 border-t border-color-border max-h-48 overflow-y-auto">
                    {items.length > 0 ? (
                        <ul className="space-y-1">
                            {items.map((item, index) => (
                                <li key={`item-${index}`} className="text-sm py-1 px-2 rounded hover:bg-color-muted/10">
                                    {item}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="text-sm text-muted py-2">{t('upload.noItems')}</div>
                    )}
                </div>
            )}
        </div>
    );
}
