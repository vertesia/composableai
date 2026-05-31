import { useMemo, type ReactNode } from 'react';

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
                    // biome-ignore lint/suspicious/noArrayIndexKey: static formatted text lines
                    <span key={index}>
                        {renderJsonLine(line)}
                        {index < lines.length - 1 ? '\n' : null}
                    </span>
                ))}
            </code>
        </pre>
    );
}

const JSON_TOKEN_PATTERN =
    /("(?:\\.|[^"\\])*"(?=\s*:))|("(?:\\.|[^"\\])*")|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

function renderJsonLine(line: string) {
    JSON_TOKEN_PATTERN.lastIndex = 0;
    const parts: ReactNode[] = [];
    let cursor = 0;
    let match = JSON_TOKEN_PATTERN.exec(line);

    while (match !== null) {
        if (match.index > cursor) {
            parts.push(line.slice(cursor, match.index));
        }

        const [token, key, stringValue, literal, numberValue] = match;
        const className = key
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
