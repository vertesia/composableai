import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n'; // register plugin-specific translations
import './index.css';
// initialize dev environment
import './env';
import { AppEntry } from './app-ui-entry';

const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error('Root element not found');
}

createRoot(rootElement).render(
    <StrictMode>
<<<<<<< HEAD
        <AppEntry />
=======
        {/*
          preserveSignInPath keeps deep links working: without it the sign-in screen resets the
          URL to "/" while the session boots, so /app/<route> — and the ?a=/?p= and #token= the
          Central Auth handoff arrives with — are lost before the router ever sees them.
        */}
        <VertesiaShell preserveSignInPath>
            <OrgGate>
                <RouterProvider routes={routes} />
            </OrgGate>
        </VertesiaShell>
>>>>>>> 826002c5 (fix(ui): keep XML parsing and plugin deep links browser-safe (#1798))
    </StrictMode>,
);
