import type { AgentMessage } from "@vertesia/common";
import { Badge, cn } from "@vertesia/ui/core";
import { useUserSession } from "@vertesia/ui/session";
import { ExternalLinkIcon, ImageIcon, MonitorIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useUITranslation } from "../../../i18n/index.js";
import { useImageLightbox } from "./ImageLightbox.js";
import { getArtifactCacheKey, useArtifactUrlCache } from "./useArtifactUrlCache.js";

export interface BrowserUseWidgetState {
    widget?: "browseruse" | string;
    browser_workflow_id?: string;
    workstream_id?: string;
    phase?: string;
    url?: string;
    title?: string;
    screenshot?: string;
    raw_screenshot?: string;
    prefer_raw_screenshot?: boolean;
    updated_at?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getBrowserUseWidgetState(details: unknown): BrowserUseWidgetState | undefined {
    if (!isRecord(details)) return undefined;
    const value = details.browseruse ?? details.browser_use;
    if (!isRecord(value)) return undefined;

    const state: BrowserUseWidgetState = {
        widget: typeof value.widget === "string" ? value.widget : undefined,
        browser_workflow_id: typeof value.browser_workflow_id === "string" ? value.browser_workflow_id : undefined,
        workstream_id: typeof value.workstream_id === "string" ? value.workstream_id : undefined,
        phase: typeof value.phase === "string" ? value.phase : undefined,
        url: typeof value.url === "string" ? value.url : undefined,
        title: typeof value.title === "string" ? value.title : undefined,
        screenshot: typeof value.screenshot === "string" ? value.screenshot : undefined,
        raw_screenshot: typeof value.raw_screenshot === "string" ? value.raw_screenshot : undefined,
        prefer_raw_screenshot: typeof value.prefer_raw_screenshot === "boolean" ? value.prefer_raw_screenshot : undefined,
        updated_at: typeof value.updated_at === "number" ? value.updated_at : undefined,
    };

    if (state.widget && state.widget !== "browseruse") return undefined;
    if (!state.url && !state.title && !state.screenshot && !state.raw_screenshot) return undefined;
    return state;
}

export function getLatestBrowserUseByWorkstream(messages: AgentMessage[]): Map<string, BrowserUseWidgetState> {
    const latest = new Map<string, { state: BrowserUseWidgetState; timestamp: number }>();
    for (const message of messages) {
        const state = getBrowserUseWidgetState(message.details);
        if (!state) continue;
        const workstreamId = state.workstream_id || message.workstream_id || "main";
        const timestamp = state.updated_at
            ?? (typeof message.timestamp === "number" ? message.timestamp : new Date(message.timestamp).getTime());
        const previous = latest.get(workstreamId);
        if (!previous || timestamp >= previous.timestamp) {
            latest.set(workstreamId, { state: { ...state, workstream_id: workstreamId }, timestamp });
        }
    }
    return new Map(Array.from(latest.entries()).map(([workstreamId, entry]) => [workstreamId, entry.state]));
}

function artifactPathFromRef(ref: string): string {
    return ref.replace(/^artifact:\/\//, "").replace(/^artifact:/, "").replace(/^\/+/, "");
}

function phaseLabel(phase?: string): string {
    if (!phase) return "browser";
    return phase.replace(/_/g, " ");
}

interface BrowserUseWidgetProps {
    state: BrowserUseWidgetState;
    runId?: string;
    className?: string;
}

export function BrowserUseWidget({ state, runId, className }: BrowserUseWidgetProps) {
    const { t } = useUITranslation();
    const { client } = useUserSession();
    const urlCache = useArtifactUrlCache();
    const { openImage } = useImageLightbox();
    const [imageUrl, setImageUrl] = useState<string | undefined>();

    const screenshotRef = state.prefer_raw_screenshot === false
        ? state.screenshot || state.raw_screenshot
        : state.raw_screenshot || state.screenshot;
    const title = state.title || state.url || t("agent.browserUse");
    const imageName = useMemo(() => {
        if (!screenshotRef) return t("agent.browserScreenshot");
        return artifactPathFromRef(screenshotRef).split("/").pop() || t("agent.browserScreenshot");
    }, [screenshotRef, t]);

    useEffect(() => {
        if (!screenshotRef) {
            setImageUrl(undefined);
            return;
        }
        if (screenshotRef.startsWith("http://") || screenshotRef.startsWith("https://")) {
            setImageUrl(screenshotRef);
            return;
        }
        if (!runId) {
            setImageUrl(undefined);
            return;
        }

        let cancelled = false;
        const resolveScreenshot = async () => {
            const artifactPath = artifactPathFromRef(screenshotRef);
            try {
                const cacheKey = getArtifactCacheKey(runId, artifactPath, "inline");
                const url = urlCache
                    ? await urlCache.getOrFetch(cacheKey, async () => {
                        const result = await client.files.getArtifactDownloadUrl(runId, artifactPath, "inline");
                        return result.url;
                    })
                    : (await client.files.getArtifactDownloadUrl(runId, artifactPath, "inline")).url;
                if (!cancelled) setImageUrl(url);
            } catch (err) {
                console.error(`Failed to resolve browser screenshot ${artifactPath}`, err);
                if (!cancelled) setImageUrl(undefined);
            }
        };
        void resolveScreenshot();
        return () => {
            cancelled = true;
        };
    }, [client, runId, screenshotRef, urlCache]);

    return (
        <div className={cn("overflow-hidden rounded-md border border-muted bg-mixer-muted/10", className)}>
            <div className="flex items-start justify-between gap-2 border-b border-muted px-2.5 py-2">
                <div className="flex min-w-0 items-start gap-2">
                    <MonitorIcon className="mt-0.5 size-4 shrink-0 text-info" />
                    <div className="min-w-0">
                        <div className="text-xs font-medium text-foreground">{t("agent.browserUse")}</div>
                        <div className="truncate text-xs text-muted" title={title}>{title}</div>
                    </div>
                </div>
                <Badge variant="info" className="shrink-0 capitalize">
                    {phaseLabel(state.phase)}
                </Badge>
            </div>

            {imageUrl ? (
                <button
                    type="button"
                    className="block w-full bg-mixer-muted/20 text-left"
                    onClick={() => openImage(imageUrl, imageName)}
                    title={t("agent.clickToEnlarge")}
                >
                    <img
                        src={imageUrl}
                        alt={imageName}
                        className="block max-h-56 w-full object-contain"
                    />
                </button>
            ) : (
                <div className="flex min-h-28 items-center justify-center gap-2 bg-mixer-muted/20 px-3 py-6 text-xs text-muted">
                    <ImageIcon className="size-4" />
                    <span>{t("agent.browserScreenshotPending")}</span>
                </div>
            )}

            {state.url && (
                <div className="flex items-center gap-2 border-t border-muted px-2.5 py-1.5">
                    <a
                        href={state.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-w-0 flex-1 truncate text-xs text-info hover:underline"
                        title={state.url}
                    >
                        {state.url}
                    </a>
                    <a
                        href={state.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={t("agent.openInNewTab")}
                        className={cn(
                            "inline-flex h-6 shrink-0 items-center justify-center rounded-md px-1.5",
                            "text-muted hover:bg-muted hover:text-foreground"
                        )}
                    >
                        <ExternalLinkIcon className="size-3" />
                    </a>
                </div>
            )}
        </div>
    );
}
