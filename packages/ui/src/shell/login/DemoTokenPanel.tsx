import { Key } from "lucide-react";
import { useEffect, useState } from "react";
import {
    type DemoTokenInfo,
    clearDemoToken,
    demoFlowFor,
    inspectDemoToken,
    readDemoTenantName,
    readDemoToken,
    writeDemoTenantName,
    writeDemoToken,
} from "./loginUtils";

// Floating dev-only widget: paste a Firebase ID token into localStorage. The
// flow that the SigninScreen runs when a provider button is clicked is inferred
// from the token's email domain:
//   • staff (vertesiahq.com) → hands the token off to UserSessionProvider's
//     existing token+state branch via STS, so the app loads as signed-in.
//   • anything else → posts to /auth/ensure-user, surfacing the real 403/412/200
//     so the customer-domain block lands on TenantBlockedStep.

function formatRemaining(expiresAt: Date | undefined, expired: boolean): string | null {
    if (expired) return "EXPIRED";
    if (!expiresAt) return null;
    const ms = expiresAt.getTime() - Date.now();
    if (ms <= 0) return "EXPIRED";
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return min > 0 ? `${min}m ${sec}s` : `${sec}s`;
}

function flowLabel(info: DemoTokenInfo | null): string {
    const flow = demoFlowFor(info);
    if (flow === "success") return "→ Sign-in success";
    if (flow === "blocked") return "→ Blocked (403)";
    return "";
}

export default function DemoTokenPanel() {
    const [open, setOpen] = useState(false);
    const [info, setInfo] = useState<DemoTokenInfo | null>(() => readDemoToken());
    const [tenantName, setTenantName] = useState(() => readDemoTenantName() ?? "");
    const [draft, setDraft] = useState("");
    const [, setTick] = useState(0);

    useEffect(() => {
        if (!info?.expiresAt) return;
        const t = setInterval(() => setTick((n) => n + 1), 15_000);
        return () => clearInterval(t);
    }, [info?.expiresAt]);

    const save = () => {
        const trimmed = draft.trim();
        if (!trimmed) return;
        writeDemoToken(trimmed);
        setInfo(inspectDemoToken(trimmed));
        setDraft("");
    };

    const clear = () => {
        clearDemoToken();
        setInfo(null);
    };

    const onTenantNameChange = (next: string) => {
        setTenantName(next);
        writeDemoTenantName(next);
    };

    const remaining = info ? formatRemaining(info.expiresAt, info.expired) : null;
    const flow = demoFlowFor(info);

    return (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 999999, fontFamily: "system-ui, sans-serif" }}>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-label="Demo sign-in panel"
                className={
                    "cursor-pointer inline-flex items-center gap-1.5 rounded-md border border-foreground bg-transparent px-2.5 py-1 text-xs font-medium text-foreground transition-opacity hover:opacity-100 focus-visible:opacity-100 " +
                    (open ? "opacity-100" : "opacity-10")
                }
            >
                <Key className="size-3.5" />
                <span>Demo{info ? ` · ${remaining}` : ""}</span>
            </button>

            {open && (
                <div
                    style={{
                        position: "absolute",
                        top: 38,
                        right: 0,
                        width: 380,
                        background: "white",
                        border: "1px solid #d1d5db",
                        borderRadius: 8,
                        boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
                        padding: 16,
                        fontSize: 13,
                        color: "#111827",
                    }}
                >
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>Demo sign-in (dev only)</div>
                    <div style={{ color: "#6b7280", fontSize: 12, marginBottom: 12, lineHeight: 1.4 }}>
                        Paste a Firebase ID token. Provider buttons on the sign-in screen will route automatically based
                        on the token's email domain — staff (vertesiahq.com) signs in, customer domains hit the 403
                        block.
                    </div>

                    {info && (
                        <div
                            style={{
                                background: info.expired ? "#fef2f2" : flow === "success" ? "#f0fdf4" : "#f9fafb",
                                border: `1px solid ${info.expired ? "#fca5a5" : flow === "success" ? "#bbf7d0" : "#e5e7eb"}`,
                                borderRadius: 6,
                                padding: 10,
                                marginBottom: 12,
                                fontSize: 12,
                                lineHeight: 1.5,
                            }}
                        >
                            <div>
                                <strong>email:</strong> {info.email ?? "—"}
                            </div>
                            <div>
                                <strong>expires:</strong> {info.expiresAt ? info.expiresAt.toLocaleString() : "—"}
                            </div>
                            {!info.expired && remaining && (
                                <div>
                                    <strong>remaining:</strong> {remaining}
                                </div>
                            )}
                            {flow && !info.expired && (
                                <div
                                    style={{
                                        marginTop: 6,
                                        fontWeight: 600,
                                        color: flow === "success" ? "#166534" : "#92400e",
                                    }}
                                >
                                    {flowLabel(info)}
                                </div>
                            )}
                            {info.expired && (
                                <div style={{ color: "#991b1b", fontWeight: 600, marginTop: 4 }}>
                                    EXPIRED — grab a fresh token from dev-main and re-paste.
                                </div>
                            )}
                        </div>
                    )}

                    <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder="Paste Firebase ID token (eyJ...)"
                        style={{
                            width: "100%",
                            minHeight: 80,
                            padding: 8,
                            border: "1px solid #d1d5db",
                            borderRadius: 6,
                            fontFamily: "ui-monospace, monospace",
                            fontSize: 11,
                            resize: "vertical",
                            marginBottom: 8,
                            boxSizing: "border-box",
                        }}
                    />
                    <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                        <button
                            type="button"
                            onClick={save}
                            disabled={!draft.trim()}
                            style={{
                                flex: 1,
                                padding: "6px 12px",
                                border: "1px solid #1f2937",
                                background: "#1f2937",
                                color: "white",
                                borderRadius: 6,
                                cursor: draft.trim() ? "pointer" : "not-allowed",
                                opacity: draft.trim() ? 1 : 0.5,
                                fontSize: 12,
                                fontWeight: 500,
                            }}
                        >
                            Save
                        </button>
                        <button
                            type="button"
                            onClick={clear}
                            disabled={!info}
                            style={{
                                flex: 1,
                                padding: "6px 12px",
                                border: "1px solid #d1d5db",
                                background: "white",
                                color: "#374151",
                                borderRadius: 6,
                                cursor: info ? "pointer" : "not-allowed",
                                opacity: info ? 1 : 0.5,
                                fontSize: 12,
                                fontWeight: 500,
                            }}
                        >
                            Clear
                        </button>
                    </div>

                    <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
                        Optional: tenant name shown in the blocked view
                    </div>
                    <input
                        type="text"
                        value={tenantName}
                        onChange={(e) => onTenantNameChange(e.target.value)}
                        placeholder="e.g. Charles Morman - Testing"
                        style={{
                            width: "100%",
                            padding: "6px 8px",
                            border: "1px solid #d1d5db",
                            borderRadius: 6,
                            fontSize: 12,
                            boxSizing: "border-box",
                        }}
                    />
                </div>
            )}
        </div>
    );
}
