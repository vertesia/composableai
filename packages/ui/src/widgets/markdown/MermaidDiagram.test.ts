import { describe, expect, it, vi } from 'vitest';

// Avoid loading the real (heavy, DOM-driven) mermaid library — the module calls
// mermaid.initialize() at import time. We only exercise the pure makeSvgResponsive helper.
vi.mock('mermaid', () => ({ default: { initialize: vi.fn(), render: vi.fn() } }));

import { makeSvgResponsive } from './MermaidDiagram';

const RESPONSIVE_STYLE = 'width:100%;height:auto;display:block;max-width:100%;';

describe('makeSvgResponsive', () => {
    it('drops fixed width/height and injects a responsive style + preserveAspectRatio', () => {
        const out = makeSvgResponsive('<svg width="100" height="50">body</svg>');
        expect(out).not.toContain('width="100"');
        expect(out).not.toContain('height="50"');
        expect(out).toContain(`style="${RESPONSIVE_STYLE}"`);
        expect(out).toContain('preserveAspectRatio="xMidYMid meet"');
        expect(out).toContain('body</svg>');
    });

    it('merges into an existing style attribute and keeps other attributes', () => {
        const out = makeSvgResponsive('<svg viewBox="0 0 10 10" style="color:red">a</svg>');
        expect(out).toContain('viewBox="0 0 10 10"');
        expect(out).toContain(`style="color:red;${RESPONSIVE_STYLE}"`);
    });

    it('does not add a second preserveAspectRatio when one is present', () => {
        const out = makeSvgResponsive('<svg preserveAspectRatio="none">a</svg>');
        expect(out.match(/preserveAspectRatio=/gi)).toHaveLength(1);
    });

    // Regression guard for CodeQL js/polynomial-redos: `[^<>]` (not `[^>]`) keeps a
    // run like `<svg<svg…` with no closing `>` from being re-scanned at every position.
    it('runs in linear time on a pathological input', () => {
        const evil = `<svg${'<svg='.repeat(100_000)}`;
        const start = performance.now();
        makeSvgResponsive(evil);
        expect(performance.now() - start).toBeLessThan(1000);
    });
});
