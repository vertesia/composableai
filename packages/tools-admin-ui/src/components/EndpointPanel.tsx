import { useState } from 'react';

export function EndpointPanel({ label, path }: { label: string; path: string }) {
    const [copied, setCopied] = useState(false);

    function handleCopy() {
        const url = window.location.origin + path;
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    }

    return (
        <div className="vta-endpoint">
            <div className="vta-endpoint-label">{label}</div>
            <div className="vta-endpoint-box">
                <code className="vta-endpoint-code">{path}</code>
                <button onClick={handleCopy} className="vta-copy-btn" title="Copy full URL">
                    {copied ? '\u2713' : '\u29C9'}
                </button>
            </div>
        </div>
    );
}
