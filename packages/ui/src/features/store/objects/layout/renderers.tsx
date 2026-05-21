import dayjs from "dayjs";
import LocalizedFormat from "dayjs/plugin/localizedFormat";
import RelativeTime from "dayjs/plugin/relativeTime";
import { shortId } from "../../../utils";
import { ExternalLink, Eye } from "lucide-react";
import { Button } from "@vertesia/ui/core";
dayjs.extend(RelativeTime);
dayjs.extend(LocalizedFormat);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function getStringProperty(value: unknown, property: string): string | undefined {
    if (!isRecord(value)) return undefined;
    const propertyValue = value[property];
    return typeof propertyValue === "string" ? propertyValue : undefined;
}

function getObjectId(value: unknown): string {
    if (typeof value === "string") return value;
    return getStringProperty(value, "id") || "";
}

function renderableValue(value: unknown): React.ReactNode {
    if (value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return value;
    }
    return String(value);
}

const renderers: Record<string, (params?: URLSearchParams, onClick?: (id: string) => void) => (value: unknown, index: number) => React.ReactNode> = {
    string(params?: URLSearchParams, _onClick?: (id: string) => void) {
        let transforms: ((value: string) => string)[] = [];
        if (params) {
            const slice = params.get("slice");
            if (slice) {
                transforms.push((value: string) => value.slice(parseInt(slice)));
            }
            const max_length = params.get("max_length");
            if (max_length) {
                transforms.push((value: string) => value.slice(0, parseInt(max_length)));
            }
            if (params.has("upper")) {
                transforms.push((value: string) => value.toUpperCase());
            }
            if (params.has("lower")) {
                transforms.push((value: string) => value.toLowerCase());
            }
            if (params.has("capitalize")) {
                transforms.push((value: string) => value[0].toUpperCase() + value.substring(1));
            }
            if (params.has("ellipsis")) {
                transforms.push((value: string) => value + "...");
            }
        }
        return (value: unknown, index: number) => {
            let v: string;
            if (value) {
                v = String(value);
                if (transforms.length > 0) {
                    for (const t of transforms) {
                        v = t(v);
                    }
                }
            } else {
                v = "";
            }

            return <td key={index}>{v}</td>;
        };
    },

    fileSize(_params?: URLSearchParams, _onClick?: (id: string) => void) {
        return (value: unknown, index: number) => {
            let fileSize = "";
            if (value) {
                const bytes = Number(value);
                if (!isNaN(bytes)) {
                    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
                    if (bytes === 0) {
                        fileSize = "0 Bytes";
                    } else {
                        const i = Math.floor(Math.log(bytes) / Math.log(1024));
                        fileSize = `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
                    }
                } else {
                    fileSize = String(value);
                }
            }
            return <td key={index}>{fileSize}</td>;
        };
    },

    number(params?: URLSearchParams, _onClick?: (id: string) => void) {
        let currency: string | undefined;
        let decimals: string | undefined;
        if (params) {
            currency = params.get("currency") || undefined;
            decimals = params.get("decimals") || undefined;
        }

        const digits = decimals ? parseInt(decimals) : 2;

        return (value: unknown, index: number) => {
            const numberValue = Number(value);
            let v = new Intl.NumberFormat("en-US", {
                style: currency ? "currency" : "decimal",
                currency,
                maximumFractionDigits: digits,
            }).format(Number.isFinite(numberValue) ? numberValue : 0);
            return <td key={index}>{v}</td>;
        };
    },
    objectId(params?: URLSearchParams, onClick?: (id: string) => void) {
        let transforms: ((value: string) => string)[] = [];
        let hasSlice = false;
        if (params) {
            const slice = params.get("slice");
            if (slice) {
                hasSlice = true;
                transforms.push((value) => value.slice(parseInt(slice)));
            }
        }
        return (value: unknown, index: number) => {
            const objectId = getObjectId(value);
            const displayValue = transforms.reduce((v, t) => t(v), objectId);
            return (
                <td key={index} className="flex justify-between items-center gap-2">
                    {hasSlice ? '~' : ''}{displayValue}
                    <Button
                        variant="ghost"
                        alt="Preview Object"
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
    objectName(params?: URLSearchParams, _onClick?: (id: string) => void) {
        let title = "title";
        if (params) {
            title = params.get("title") || "title";
        }
        return (value: unknown, index: number) => {
            const properties = isRecord(value) && isRecord(value.properties) ? value.properties : undefined;
            const titleValue = properties?.[title];
            const titleText = renderableValue(titleValue);
            const name = getStringProperty(value, "name");
            const id = getStringProperty(value, "id");
            return (
                <td key={index}>
                    {titleText || name || (id ? shortId(id) : "")}
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
                <td key={index} className="flex justify-between items-center gap-2 max-w-48">
                    {hasSlice ? "~" : ""}{displayValue}
                    <Button
                        variant="ghost"
                        alt="Preview Object"
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
        return (value: unknown, index: number) => {
            return <td key={index}>{getStringProperty(value, "name") || "n/a"}</td>;
        };
    },
    revision(_params?: URLSearchParams, _onClick?: (id: string) => void) {
        return (value: unknown, index: number) => {
            const rev = isRecord(value) && isRecord(value.revision) ? value.revision : undefined;
            if (!rev) return <td key={index} />;
            const root = getStringProperty(rev, "root");
            const label = getStringProperty(rev, "label");
            return (
                <td key={index}>
                    <div className="flex flex-col gap-0.5">
                        {root &&
                            <div className="flex items-center gap-1">
                                <span className="text-xs text-muted font-mono">
                                    root: ~{root.slice(-7)}
                                </span>
                                <a
                                    href={`/store/objects/${root}`}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <ExternalLink className="size-3 text-muted" />
                                </a>
                            </div>
                        }
                        {label && <span className="text-xs text-muted">label: {label}</span>}
                    </div>
                </td>
            );
        };
    },
    date(params?: URLSearchParams, _onClick?: (id: string) => void) {
        let method = "format";
        let arg: string | undefined = "LLL";
        if (params) {
            const localized = params.get("localized");
            if (localized) {
                arg = localized;
            } else {
                const relative = params.get("relative");
                if (relative) {
                    method = relative; // fromNow or toNow
                    arg = undefined;
                }
            }
        }
        return (value: unknown, index: number) => {
            const dateValue = typeof value === "string" || typeof value === "number" || value instanceof Date ? value : undefined;
            const date = dayjs(dateValue);
            const text = method === "fromNow" ? date.fromNow() : method === "toNow" ? date.toNow() : date.format(arg);
            return <td key={index}>{text}</td>;
        };
    },
};

export default renderers;
