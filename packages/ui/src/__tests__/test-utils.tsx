import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { I18nProvider } from '../i18n/index.js';

function Providers({ children }: { children: ReactNode }) {
    return <I18nProvider lng="en">{children}</I18nProvider>;
}

export function renderWithProviders(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
    return render(ui, { wrapper: Providers, ...options });
}
