import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { HomePage } from './HomePage';

vi.mock('@vertesia/ui/env', () => ({
    Env: { name: 'Example App' },
}));

describe('HomePage', () => {
    it('renders the configured app name and scaffold guidance', () => {
        const markup = renderToStaticMarkup(<HomePage />);

        expect(markup).toContain('>Example App</h1>');
        expect(markup).toContain('Build UI in src/modules/app/ui and resources in src/modules/app/resources.');
    });
});
