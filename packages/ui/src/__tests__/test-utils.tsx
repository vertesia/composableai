import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { I18nProvider } from '@vertesia/ui/i18n';

function Providers({ children }: { children: ReactNode }) {
    return <I18nProvider lng="en">{children}</I18nProvider>;
}

export function renderWithProviders(
    ui: ReactElement,
    options?: Omit<RenderOptions, 'wrapper'>,
): RenderResult {
    return render(ui, { wrapper: Providers, ...options });
}
