import { render, waitFor } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MermaidDiagram } from './MermaidDiagram';

// Renders the real Mermaid library: Mermaid source reaches this component from LLM output and documents,
// so it must be treated as untrusted. jsdom has no layout engine, so stub the measurements Mermaid takes,
// and report label images as loaded (Mermaid waits for them, and jsdom never fetches them).
const STUBS: [object, PropertyKey, PropertyDescriptor][] = [
    [SVGElement.prototype, 'getBBox', { value: () => ({ x: 0, y: 0, width: 80, height: 20 }) }],
    [SVGElement.prototype, 'getComputedTextLength', { value: () => 80 }],
    [HTMLImageElement.prototype, 'complete', { get: () => true }],
];
const originals = STUBS.map(([target, key]) => Object.getOwnPropertyDescriptor(target, key));

beforeAll(() => {
    for (const [target, key, descriptor] of STUBS) {
        Object.defineProperty(target, key, { configurable: true, ...descriptor });
    }
});

afterAll(() => {
    STUBS.forEach(([target, key], i) => {
        const original = originals[i];
        if (original) {
            Object.defineProperty(target, key, original);
        } else {
            Reflect.deleteProperty(target, key);
        }
    });
});

async function renderDiagram(code: string): Promise<HTMLElement> {
    const { container } = render(<MermaidDiagram code={code} />);
    await waitFor(() => expect(container.querySelector('svg')).not.toBeNull(), { timeout: 10_000 });
    return container;
}

/** Every attribute in the rendered diagram that would run script: `on*` handlers and `javascript:` URLs. */
function scriptAttributes(container: HTMLElement): string[] {
    return Array.from(container.querySelectorAll('*')).flatMap((el) =>
        Array.from(el.attributes)
            .filter(
                (attr) =>
                    attr.name.toLowerCase().startsWith('on') ||
                    // biome-ignore lint/suspicious/noControlCharactersInRegex: browsers ignore these in URL schemes
                    /^javascript:/i.test(attr.value.replace(/[\u0000- ]/g, '')),
            )
            .map((attr) => `<${el.tagName.toLowerCase()} ${attr.name}="${attr.value}">`),
    );
}

function labels(container: HTMLElement): string[] {
    return Array.from(container.querySelectorAll('.nodeLabel')).map((el) => el.innerHTML);
}

describe('MermaidDiagram with untrusted source', () => {
    it('drops a javascript: URL from a click directive', async () => {
        const container = await renderDiagram(
            'flowchart TD\n    A[Start] --> B[End]\n    click A href "javascript:alert(document.domain)"',
        );
        expect(scriptAttributes(container)).toEqual([]);
        expect(labels(container)).toEqual(['<p>Start</p>', '<p>End</p>']);
    }, 15_000);

    it('keeps an https link from a click directive', async () => {
        const container = await renderDiagram(
            'flowchart TD\n    A[Start] --> B[End]\n    click A href "https://example.com/docs"',
        );
        expect(container.querySelector('a[href="https://example.com/docs"]')).not.toBeNull();
    }, 15_000);

    it('drops event handlers from HTML in a node label', async () => {
        const container = await renderDiagram(
            'flowchart TD\n    A["<img src=x onerror=alert(1)>"] --> B["<a href=\'javascript:alert(2)\'>link</a>"]',
        );
        expect(container.querySelector('script')).toBeNull();
        expect(scriptAttributes(container)).toEqual([]);
    }, 15_000);

    it('does not bind click callbacks', async () => {
        const container = await renderDiagram('flowchart TD\n    A[Start] --> B[End]\n    click A call alert(1)');
        expect(scriptAttributes(container)).toEqual([]);
    }, 15_000);

    it('still renders labels and line breaks', async () => {
        const container = await renderDiagram('flowchart TD\n    A["Line one\\nLine two"] --> B[Done]');
        expect(labels(container)).toEqual(['<p>Line one<br>Line two</p>', '<p>Done</p>']);
    }, 15_000);
});
