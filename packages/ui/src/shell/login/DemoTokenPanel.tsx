import { Key, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
    type DemoTokenInfo,
    addDemoToken,
    clearAllDemoTokens,
    demoFlowFor,
    listDemoTokens,
    readDemoTenantName,
    removeDemoToken,
    writeDemoTenantName,
} from "./loginUtils";

// Floating dev-only widget. Multiple Firebase ID tokens can be staged, keyed by
// their decoded email. When the user clicks a provider button on the
// SigninScreen, the screen looks up a token by the typed (or returning-session)
// email and runs a flow based on that token's domain:
//   • staff (vertesiahq.com) → STS exchange → app loads as signed-in
//   • everything else → POST /auth/ensure-user → real 403/412 routes the UI

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

function flowLabel(info: DemoTokenInfo): string {
    const flow = demoFlowFor(info);
    if (flow === "success") return "Sign-in success";
    if (flow === "blocked") return "Blocked (403)";
    return "—";
}

function flowColor(info: DemoTokenInfo): { bg: string; border: string; text: string } {
    if (info.expired) return { bg: "#fef2f2", border: "#fca5a5", text: "#991b1b" };
    const flow = demoFlowFor(info);
    if (flow === "success") return { bg: "#f0fdf4", border: "#bbf7d0", text: "#166534" };
    return { bg: "#fffbeb", border: "#fcd34d", text: "#92400e" };
}

export default function DemoTokenPanel() {
    const [open, setOpen] = useState(false);
    const [tokens, setTokens] = useState<DemoTokenInfo[]>(() => listDemoTokens());
    const [tenantName, setTenantName] = useState(() => readDemoTenantName() ?? "");
    const [draft, setDraft] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [, setTick] = useState(0);

    // Live-update remaining countdowns while any token is staged.
    useEffect(() => {
        if (tokens.length === 0) return;
        const t = setInterval(() => setTick((n) => n + 1), 15_000);
        return () => clearInterval(t);
    }, [tokens.length]);

    const save = () => {
        setError(null);
        const info = addDemoToken(draft);
        if (!info) {
            setError("Couldn't decode an email from that token.");
            return;
        }
        setTokens(listDemoTokens());
        setDraft("");
    };

    const remove = (email: string | undefined) => {
        if (!email) return;
        removeDemoToken(email);
        setTokens(listDemoTokens());
    };

    const clearAll = () => {
        clearAllDemoTokens();
        setTokens([]);
    };

    const onTenantNameChange = (next: string) => {
        setTenantName(next);
        writeDemoTenantName(next);
    };

    const chipCount = tokens.length;
    const hasExpired = tokens.some((t) => t.expired);

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
                <span>
                    Demo
                    {chipCount > 0 ? ` · ${chipCount}` : ""}
                    {hasExpired ? " · EXP" : ""}
                </span>
            </button>

            {open && (
                <div
                    style={{
                        position: "absolute",
                        top: 38,
                        right: 0,
                        width: 420,
                        maxHeight: "80vh",
                        overflowY: "auto",
                        background: "white",
                        border: "1px solid #d1d5db",
                        borderRadius: 8,
                        boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
                        padding: 14,
                        fontSize: 13,
                        color: "#111827",
                    }}
                >
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>Demo sign-in (dev only)</div>
                    <div style={{ color: "#6b7280", fontSize: 11, marginBottom: 12, lineHeight: 1.4 }}>
                        Paste Firebase ID tokens — one at a time. They're keyed by email; the SigninScreen picks the
                        matching one based on the email the user typed.
                    </div>

                    {tokens.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                            {tokens.map((info) => {
                                const color = flowColor(info);
                                const remaining = formatRemaining(info.expiresAt, info.expired);
                                return (
                                    <div
                                        key={info.email ?? info.token.slice(-12)}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8,
                                            background: color.bg,
                                            border: `1px solid ${color.border}`,
                                            borderRadius: 6,
                                            padding: 8,
                                            marginBottom: 6,
                                            fontSize: 11,
                                            lineHeight: 1.4,
                                        }}
                                    >
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div
                                                style={{
                                                    fontWeight: 600,
                                                    color: color.text,
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                {info.email ?? "(no email)"}
                                            </div>
                                            <div style={{ color: "#6b7280" }}>
                                                {flowLabel(info)}
                                                {remaining ? ` · ${remaining}` : ""}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            aria-label={`Remove ${info.email ?? "token"}`}
                                            onClick={() => remove(info.email)}
                                            style={{
                                                background: "transparent",
                                                border: "none",
                                                color: color.text,
                                                cursor: "pointer",
                                                padding: 4,
                                                display: "inline-flex",
                                            }}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                );
                            })}
                            <button
                                type="button"
                                onClick={clearAll}
                                style={{
                                    background: "transparent",
                                    border: "none",
                                    color: "#6b7280",
                                    fontSize: 11,
                                    cursor: "pointer",
                                    padding: 0,
                                    textDecoration: "underline",
                                }}
                            >
                                Clear all
                            </button>
                        </div>
                    )}

                    <textarea
                        value={draft}
                        onChange={(e) => {
                            setDraft(e.target.value);
                            if (error) setError(null);
                        }}
                        placeholder="Paste Firebase ID token (eyJ...)"
                        style={{
                            width: "100%",
                            minHeight: 70,
                            padding: 8,
                            border: `1px solid ${error ? "#fca5a5" : "#d1d5db"}`,
                            borderRadius: 6,
                            fontFamily: "ui-monospace, monospace",
                            fontSize: 11,
                            resize: "vertical",
                            marginBottom: 6,
                            boxSizing: "border-box",
                        }}
                    />
                    {error && (
                        <div style={{ color: "#991b1b", fontSize: 11, marginBottom: 6 }}>{error}</div>
                    )}
                    <button
                        type="button"
                        onClick={save}
                        disabled={!draft.trim()}
                        style={{
                            width: "100%",
                            padding: "6px 12px",
                            border: "1px solid #1f2937",
                            background: "#1f2937",
                            color: "white",
                            borderRadius: 6,
                            cursor: draft.trim() ? "pointer" : "not-allowed",
                            opacity: draft.trim() ? 1 : 0.5,
                            fontSize: 12,
                            fontWeight: 500,
                            marginBottom: 14,
                        }}
                    >
                        Add token
                    </button>

                    <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>
                        Optional: tenant name shown in the blocked view
                    </div>
                    <input
                        type="text"
                        value={tenantName}
                        onChange={(e) => onTenantNameChange(e.target.value)}
                        placeholder="e.g. Charles Morman - Testing"
                        style={{
                            width: "100%",
                            padding: "5px 8px",
                            border: "1px solid #d1d5db",
                            borderRadius: 6,
                            fontSize: 11,
                            boxSizing: "border-box",
                        }}
                    />
                </div>
            )}
        </div>
    );
}
