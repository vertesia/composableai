import dayjs from "dayjs";
import LocalizedFormat from "dayjs/plugin/localizedFormat";
import RelativeTime from "dayjs/plugin/relativeTime";
import { shortId } from "../../../utils";
import { Eye } from "lucide-react";
import { Button } from "@vertesia/ui/core";
dayjs.extend(RelativeTime);
dayjs.extend(LocalizedFormat);

const renderers: Record<string, (params?: URLSearchParams, onClick?: (id: string) => void) => (value: any, index: number) => React.ReactNode> = {
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
        return (value: any, index: number) => {
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
        return (value: any, index: number) => {
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

        return (value: any, index: number) => {
            let v = new Intl.NumberFormat("en-US", {
                style: currency ? "currency" : "decimal",
                currency,
                maximumFractionDigits: digits,
            }).format(value);
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
        return (value: any, index: number) => {
            const displayValue = transforms.reduce((v, t) => t(v), value.id);
            return (
                <td key={index} className="flex justify-between items-center gap-2">
                    {hasSlice ? '~' : ''}{displayValue}
                    <Button
                        variant="ghost"
                        alt="Preview Object"
                        onClick={(e) => {
                            e.stopPropagation();
                            onClick?.(value.id);
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
        return (value: any, index: number) => {
            return (
                <td key={index}>
                    {value.properties?.[title] || value.name || shortId(value.id)}
                </td>
            );
        };
    },
    // objectLink - same implementation as objectId
    objectLink(params?: URLSearchParams, onClick?: (id: string) => void) {
        let transforms: ((value: string) => string)[] = [];
        const hasSlice = true;
        const slice = "-7";
        transforms.push((value) => value.slice(parseInt(slice)));

        return (value: any, index: number) => {
            const displayValue = transforms.reduce((v, t) => t(v), value.id);
            return (
                <td key={index} className="flex justify-between items-center gap-2 max-w-48">
                    {hasSlice ? "~" : ""}{displayValue}
                    <Button
                        variant="ghost"
                        alt="Preview Object"
                        onClick={(e) => {
                            e.stopPropagation();
                            onClick?.(value.id);
                        }}
                    >
                        <Eye className="size-4" />
                    </Button>
                </td>
            );
        };
    },
    typeLink(_params?: URLSearchParams, _onClick?: (id: string) => void) {
        return (value: any, index: number) => {
            return <td key={index}>{value?.name || "n/a"}</td>;
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
        return (value: any, index: number) => {
            return <td key={index}>{(dayjs(value) as any)[method](arg)}</td>;
        };
    },
};

export default renderers;
