import { useEffect, useState } from "react";
import {
    type DemoTokenInfo,
    clearDemoToken,
    inspectDemoToken,
    readDemoTenantName,
    readDemoToken,
    writeDemoTenantName,
    writeDemoToken,
} from "./loginUtils";

// Floating dev-only widget: paste a Firebase ID token into localStorage so the
// SigninScreen's provider buttons bypass real OAuth and hit /auth/ensure-user
// with this token instead. Lets us demo the blocked view on dev branch URLs
// without completing real OAuth (which fails — those URLs aren't on the
// provider redirect-URI allowlist).

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

export default function DemoTokenPanel() {
    const [open, setOpen] = useState(false);
    const [info, setInfo] = useState<DemoTokenInfo | null>(() => readDemoToken());
    const [tenantName, setTenantName] = useState(() => readDemoTenantName() ?? "");
    const [draft, setDraft] = useState("");
    const [, setTick] = useState(0);

    // Live-update the "remaining" countdown every 15s while a token is set.
    useEffect(() => {
        if (!info?.expiresAt) return;
        const t = setInterval(() => setTick(n => n + 1), 15_000);
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
    const buttonBg = info?.expired ? "#fef2f2" : info ? "#fef3c7" : "#f3f4f6";
    const buttonBorder = info?.expired ? "#fca5a5" : info ? "#fcd34d" : "#d1d5db";
    const buttonColor = info?.expired ? "#991b1b" : "#374151";

    return (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 999999, fontFamily: "system-ui, sans-serif" }}>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                style={{
                    background: buttonBg,
                    border: `1px solid ${buttonBorder}`,
                    color: buttonColor,
                    padding: "6px 10px",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                }}
            >
                🔑 Demo{info ? ` · ${remaining}` : ""}
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
                        Paste a Firebase ID token below. When set, provider buttons skip OAuth and
                        post the token directly to <code>/auth/ensure-user</code> for the real
                        server response.
                    </div>

                    {info && (
                        <div
                            style={{
                                background: info.expired ? "#fef2f2" : "#f9fafb",
                                border: `1px solid ${info.expired ? "#fca5a5" : "#e5e7eb"}`,
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
                                <strong>expires:</strong>{" "}
                                {info.expiresAt ? info.expiresAt.toLocaleString() : "—"}
                            </div>
                            {!info.expired && remaining && (
                                <div>
                                    <strong>remaining:</strong> {remaining}
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
                        onChange={e => setDraft(e.target.value)}
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
                        onChange={e => onTenantNameChange(e.target.value)}
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
