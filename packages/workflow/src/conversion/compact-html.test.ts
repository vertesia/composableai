import { expect, test } from 'vitest';
import { compactHtmlBeforePandoc } from './compact-html.js';

function compact(html: string): string {
    return compactHtmlBeforePandoc(Buffer.from(html)).toString('utf8');
}

test('removes nested hidden content while preserving visible inline XBRL and document order', () => {
    const result = compact(`<!doctype html><main class="layout">
        before<script>script text</script>
        <div style=" color:red; DISPLAY : none !important "><p>hidden <b>nested</b></p></div>
        <ix:hidden><ix:nonfraction>taxonomy value</ix:nonfraction></ix:hidden>
        <p>Revenue <ix:nonfraction name="us-gaap:Revenue">42.5</ix:nonfraction> billion</p>after
    </main>`);

    expect(result).not.toContain('script text');
    expect(result).not.toContain('hidden');
    expect(result).not.toContain('nested');
    expect(result).not.toContain('taxonomy value');
    expect(result).toContain('before');
    expect(result).toContain('<ix:nonfraction name="us-gaap:Revenue">42.5</ix:nonfraction>');
    expect(result.indexOf('before')).toBeLessThan(result.indexOf('Revenue'));
    expect(result.indexOf('Revenue')).toBeLessThan(result.indexOf('after'));
});

test('preserves links, images, table structure, spans, identifiers, and escaped text', () => {
    const result = compact(`<section id="results" class="presentation" style="font-size:10pt">
        <h2>Results &amp; outlook</h2>
        <a href="#results" title='Annual "results"'>See &lt;results&gt;</a>
        <img src="chart.png" alt="Revenue &amp; margin">
        <table><tr><th colspan="2" scope="col">Revenue</th></tr><tr><td rowspan="2">2025</td><td>€42.5</td></tr></table>
    </section>`);

    expect(result).toContain('id="results"');
    expect(result).not.toContain('class=');
    expect(result).not.toContain('style=');
    expect(result).toContain('href="#results"');
    expect(result).toContain('title="Annual &quot;results&quot;"');
    expect(result).toContain('src="chart.png" alt="Revenue &amp; margin"');
    expect(result).toContain('<th colspan="2" scope="col">Revenue</th>');
    expect(result).toContain('<td rowspan="2">2025</td>');
    expect(result).toContain('Results &amp; outlook');
    expect(result).toContain('See &lt;results&gt;');
    expect(result).toContain('€42.5');
});

test('handles malformed HTML conservatively and does not substring-match display properties', () => {
    const result = compact(`<div style="--display:none; display-mode:none">visible<p>still visible
        <div style="display: nonefoo">also visible</div>
        <div style="display:none; display:block">cascade visible</div>
        <div style="display:block !important; display:none">important visible</div>
        <div style="display:none !important; display:block">conservatively visible</div>
        <div hidden style="display:block">hidden attribute overridden visible</div>
        <div hidden style="display:none; display:block">hidden attribute conflict visible</div>
        <div hidden="false">actually hidden</div>`);

    expect(result).toContain('visible');
    expect(result).toContain('still visible');
    expect(result).toContain('also visible');
    expect(result).toContain('cascade visible');
    expect(result).toContain('important visible');
    expect(result).toContain('conservatively visible');
    expect(result).toContain('hidden attribute overridden visible');
    expect(result).toContain('hidden attribute conflict visible');
    expect(result).not.toContain('actually hidden');
});

test('rejects malformed UTF-8 instead of replacing source text', () => {
    expect(() => compactHtmlBeforePandoc(Buffer.from([0x3c, 0x70, 0x3e, 0xc3, 0x28]))).toThrow(TypeError);
});
