import { Check, Copy } from 'lucide-react';
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
        <div className="mb-3">
            <div className="mb-1 text-[0.7rem] font-medium uppercase tracking-widest text-primary">
                {label}
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted-background px-3 py-2">
                <code className="flex-1 font-mono text-sm text-foreground">{path}</code>
                <button
                    type="button"
                    onClick={handleCopy}
                    aria-label="Copy full URL"
                    className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-muted/50"
                >
                    {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                </button>
            </div>
        </div>
    );
}
