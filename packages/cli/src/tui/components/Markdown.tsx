import { Text } from 'ink';
import { Marked } from 'marked';
import { markedTerminal } from 'marked-terminal';

const marked = new Marked(markedTerminal() as Parameters<typeof Marked.prototype.use>[0]);

interface MarkdownProps {
    content: string;
}

/**
 * Renders markdown as ANSI-styled terminal text using marked + marked-terminal.
 */
export function Markdown({ content }: MarkdownProps) {
    let rendered: string;
    try {
        rendered = (marked.parse(content) as string).trimEnd();
    } catch {
        rendered = content;
    }

    return <Text>{rendered}</Text>;
}
