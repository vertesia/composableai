import { type RenderOptions, type RenderResult, render } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
// Use the relative source path so Vitest loads the same React instance the
// tests themselves use. Going through @vertesia/ui/i18n resolves to the
// built lib/, which links a separate React copy and triggers React's
// "Invalid hook call" detector in the a11y suite.
import { I18nProvider } from '../i18n/index.js';

function Providers({ children }: { children: ReactNode }) {
    return <I18nProvider lng="en">{children}</I18nProvider>;
}

export function renderWithProviders(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>): RenderResult {
    return render(ui, { wrapper: Providers, ...options });
}
