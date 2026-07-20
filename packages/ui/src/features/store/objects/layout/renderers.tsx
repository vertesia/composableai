import { Button, VTooltip } from '@vertesia/ui/core';
import dayjs from 'dayjs';
import LocalizedFormat from 'dayjs/plugin/localizedFormat';
import RelativeTime from 'dayjs/plugin/relativeTime';
import { ExternalLink, Eye } from 'lucide-react';
import type { ReactNode } from 'react';
import { shortId } from '../../../utils';

dayjs.extend(RelativeTime);
dayjs.extend(LocalizedFormat);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function getStringProperty(value: unknown, property: string): string | undefined {
    if (!isRecord(value)) return undefined;
    const propertyValue = value[property];
    return typeof propertyValue === 'string' ? propertyValue : undefined;
}

function getObjectId(value: unknown): string {
    if (typeof value === 'string') return value;
    return getStringProperty(value, 'id') || '';
}

function renderableValue(value: unknown): React.ReactNode {
    if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }
    return String(value);
}

const renderers: Record<
    string,
    (
        params?: URLSearchParams,
        onClick?: (id: string) => void,
    ) => (value: unknown, index: number, actions?: ReactNode) => React.ReactNode
> = {
    string(params?: URLSearchParams, _onClick?: (id: string) => void) {
        const transforms: ((value: string) => string)[] = [];
        if (params) {
            const slice = params.get('slice');
            if (slice) {
                transforms.push((value: string) => value.slice(parseInt(slice, 10)));
            }
            const max_length = params.get('max_length');
            if (max_length) {
                transforms.push((value: string) => value.slice(0, parseInt(max_length, 10)));
            }
            if (params.has('upper')) {
                transforms.push((value: string) => value.toUpperCase());
            }
            if (params.has('lower')) {
                transforms.push((value: string) => value.toLowerCase());
            }
            if (params.has('capitalize')) {
                transforms.push((value: string) => value[0].toUpperCase() + value.substring(1));
            }
            if (params.has('ellipsis')) {
                transforms.push((value: string) => `${value}...`);
            }
        }
        return (value: unknown, index: number, actions?: ReactNode) => {
            let v: string;
            if (value) {
                v = String(value);
                if (transforms.length > 0) {
                    for (const t of transforms) {
                        v = t(v);
                    }
                }
            } else {
                v = '';
            }

            return (
                <td key={index} className="group/field">
                    {actions ? (
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="truncate">{v}</span>
                            {actions}
                        </div>
                    ) : (
                        v
                    )}
                </td>
            );
        };
    },

    fileSize(_params?: URLSearchParams, _onClick?: (id: string) => void) {
        return (value: unknown, index: number) => {
            let fileSize = '';
            if (value) {
                const bytes = Number(value);
                if (!Number.isNaN(bytes)) {
                    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
                    if (bytes === 0) {
                        fileSize = '0 Bytes';
                    } else {
                        const i = Math.floor(Math.log(bytes) / Math.log(1024));
                        fileSize = `${(bytes / 1024 ** i).toFixed(2)} ${sizes[i]}`;
                    }
                } else {
                    fileSize = String(value);
                }
            }
            return (
                <td key={index} className="group/field">
                    {fileSize}
                </td>
            );
        };
    },

    number(params?: URLSearchParams, _onClick?: (id: string) => void) {
        let currency: string | undefined;
        let decimals: string | undefined;
        if (params) {
            currency = params.get('currency') || undefined;
            decimals = params.get('decimals') || undefined;
        }

        const digits = decimals ? parseInt(decimals, 10) : 2;

        return (value: unknown, index: number) => {
            const numberValue = Number(value);
            const v = new Intl.NumberFormat('en-US', {
                style: currency ? 'currency' : 'decimal',
                currency,
                maximumFractionDigits: digits,
            }).format(Number.isFinite(numberValue) ? numberValue : 0);
            return (
                <td key={index} className="group/field">
                    {v}
                </td>
            );
        };
    },
    objectId(params?: URLSearchParams, onClick?: (id: string) => void) {
        const transforms: ((value: string) => string)[] = [];
        let hasSlice = false;
        if (params) {
            const slice = params.get('slice');
            if (slice) {
                hasSlice = true;
                transforms.push((value) => value.slice(parseInt(slice, 10)));
            }
        }
        return (value: unknown, index: number, actions?: ReactNode) => {
            const objectId = getObjectId(value);
            const displayValue = transforms.reduce((v, t) => t(v), objectId);
            return (
                <td key={index} className="flex justify-start items-center gap-2 group/field">
                    <Button
                        variant="ghost"
                        title="Preview Object"
                        onClick={(e) => {
                            e.stopPropagation();
                            onClick?.(objectId);
                        }}
                    >
                        <Eye className="size-4" />
                    </Button>
                    {hasSlice ? '~' : ''}
                    {displayValue}
                    {actions}
                </td>
            );
        };
    },
    objectName(params?: URLSearchParams, _onClick?: (id: string) => void) {
        let title = 'title';
        if (params) {
            title = params.get('title') || 'title';
        }
        return (value: unknown, index: number, actions?: ReactNode) => {
            const properties = isRecord(value) && isRecord(value.properties) ? value.properties : undefined;
            const titleValue = properties?.[title];
            const titleText = renderableValue(titleValue);
            const name = getStringProperty(value, 'name');
            const id = getStringProperty(value, 'id');
            const content = titleText || name || (id ? shortId(id) : '');
            return (
                <td key={index} className="group/field">
                    {actions ? (
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="truncate">{content}</span>
                            {actions}
                        </div>
                    ) : (
                        content
                    )}
                </td>
            );
        };
    },
    // objectLink - same implementation as objectId but defaults to slice=-7
    objectLink(_params?: URLSearchParams, onClick?: (id: string) => void) {
        const transforms: ((value: string) => string)[] = [];
        const hasSlice = true;
        transforms.push((value) => value.slice(-7));

        return (value: unknown, index: number) => {
            const objectId = getObjectId(value);
            const displayValue = transforms.reduce((v, t) => t(v), objectId);
            return (
                <td key={index} className="flex justify-between items-center gap-2 max-w-48 group/field">
                    {hasSlice ? '~' : ''}
                    {displayValue}
                    <Button
                        variant="ghost"
                        title="Preview Object"
                        onClick={(e) => {
                            e.stopPropagation();
                            onClick?.(objectId);
                        }}
                    >
                        <Eye className="size-4" />
                    </Button>
                </td>
            );
        };
    },
    typeLink(_params?: URLSearchParams, _onClick?: (id: string) => void) {
        return (value: unknown, index: number, actions?: ReactNode) => {
            const content = getStringProperty(value, 'name') || 'n/a';
            return (
                <td key={index} className="group/field">
                    {actions ? (
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="truncate">{content}</span>
                            {actions}
                        </div>
                    ) : (
                        content
                    )}
                </td>
            );
        };
    },
    revision(_params?: URLSearchParams, _onClick?: (id: string) => void) {
        return (value: unknown, index: number) => {
            const rev = isRecord(value) && isRecord(value.revision) ? value.revision : undefined;
            if (!rev) return <td key={index} />;
            const root = getStringProperty(rev, 'root');
            const label = getStringProperty(rev, 'label');
            return (
                <td key={index} className="group/field">
                    <div className="flex flex-col gap-0.5">
                        {root && (
                            <div className="flex items-center gap-1">
                                <span className="text-xs text-muted font-mono">root: ~{root.slice(-7)}</span>
                                <a href={`/store/objects/${root}`} onClick={(e) => e.stopPropagation()}>
                                    <ExternalLink className="size-3 text-muted" />
                                </a>
                            </div>
                        )}
                        {label && <span className="text-xs text-muted">label: {label}</span>}
                    </div>
                </td>
            );
        };
    },
    date(params?: URLSearchParams, _onClick?: (id: string) => void) {
        // Default: relative time ("3 hours ago") with an absolute-timestamp tooltip (DisplayDate style).
        // `localized=<fmt>` keeps an absolute formatted value; `relative=fromNow|toNow` is still honored.
        let method = 'fromNow';
        let arg: string | undefined;
        if (params) {
            const localized = params.get('localized');
            if (localized) {
                method = 'format';
                arg = localized;
            } else {
                const relative = params.get('relative');
                if (relative) {
                    method = relative; // fromNow or toNow
                }
            }
        }
        return (value: unknown, index: number, actions?: ReactNode) => {
            const dateValue =
                typeof value === 'string' || typeof value === 'number' || value instanceof Date ? value : undefined;
            if (dateValue === undefined) {
                return <td key={index}>{actions}</td>;
            }
            const date = dayjs(dateValue);
            const text = method === 'format' ? date.format(arg) : method === 'toNow' ? date.toNow() : date.fromNow();
            return (
                <td key={index} className="group/field">
                    <div className="flex items-center gap-2">
                        <VTooltip description={date.format('LLL')}>{text}</VTooltip>
                        {actions}
                    </div>
                </td>
            );
        };
    },
};

export default renderers;
