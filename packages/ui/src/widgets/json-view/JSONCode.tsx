import { type ReactNode, useMemo } from 'react';

export function JSONCode({ data, className }: { data: unknown; className?: string }) {
    const jsonString = useMemo(() => {
        try {
            return JSON.stringify(data, null, 2);
        } catch (error) {
            console.error('Failed to stringify JSON:', error);
            return '{}';
        }
    }, [data]);
    const lines = useMemo(() => jsonString.split('\n'), [jsonString]);

    return (
        <pre
            className={`h-full overflow-auto rounded-md border bg-background p-3 font-mono text-xs leading-5 text-foreground ${className || ''}`}
        >
            <code>
                {lines.map((line, index) => (
                    <span key={index}>
                        {renderJsonLine(line)}
                        {index < lines.length - 1 ? '\n' : null}
                    </span>
                ))}
            </code>
        </pre>
    );
}

// A single string sub-pattern (not two near-identical alternatives) — duplicating
// `"(?:\\.|[^"\\])*"` across a `(key)|(value)` disjunction caused polynomial
// backtracking (CodeQL js/polynomial-redos). Key vs value is decided in JS below.
// The closing quote is optional (`"?`) so a malformed unterminated string tokenizes in
// one pass instead of being re-scanned at every `"` (well-formed JSON always closes it).
const JSON_TOKEN_PATTERN = /("(?:\\.|[^"\\])*"?)|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
const KEY_SUFFIX = /^\s*:/;

export function renderJsonLine(line: string) {
    JSON_TOKEN_PATTERN.lastIndex = 0;
    const parts: ReactNode[] = [];
    let cursor = 0;
    let match = JSON_TOKEN_PATTERN.exec(line);

    while (match !== null) {
        if (match.index > cursor) {
            parts.push(line.slice(cursor, match.index));
        }

        const [token, stringValue, literal, numberValue] = match;
        // A string is a key when immediately followed by a colon.
        const isKey = stringValue !== undefined && KEY_SUFFIX.test(line.slice(match.index + token.length));
        const className = isKey
            ? 'text-info'
            : stringValue
              ? 'text-success'
              : literal
                ? 'text-primary'
                : numberValue
                  ? 'text-attention'
                  : undefined;

        parts.push(
            <span key={`${match.index}-${token}`} className={className}>
                {token}
            </span>,
        );
        cursor = match.index + token.length;
        match = JSON_TOKEN_PATTERN.exec(line);
    }

    if (cursor < line.length) {
        parts.push(line.slice(cursor));
    }

    return parts.length ? parts : line;
}
