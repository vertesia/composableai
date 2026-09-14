import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n'; // register plugin-specific translations
import './index.css';
// initialize dev environment
import './env';

const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error('Root element not found');
}

async function mount(container: HTMLElement) {
    // Vite removes this branch and its imports from production builds.
    const params = new URLSearchParams(window.location.search);
    const preview = import.meta.env.DEV
        ? params.get('__vertesia_boot') === 'slow'
            ? 'boot'
            : params.get('__vertesia_auth')
        : null;
    if (preview) {
        // Leave the root empty to inspect the actual pre-React loader and its recovery timers.
        if (preview === 'boot') return;
        const [{ mountAuthScreenPreview }, { default: branding }, { appAuthScreens }] = await Promise.all([
            import('@vertesia/ui/shell'),
            import('virtual:vertesia-branding'),
            import('../modules/app/branding/screens'),
        ]);
        await mountAuthScreenPreview(container, preview, branding, appAuthScreens);
        return;
    }
    const { AppEntry } = await import('./app-ui-entry');
    createRoot(container).render(
        <StrictMode>
            <AppEntry />
        </StrictMode>,
    );
}

void mount(rootElement).catch((error: unknown) => console.error('Failed to initialize application', error));
