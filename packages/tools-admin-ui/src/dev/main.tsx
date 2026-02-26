/// <reference types="vite/client" />
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AdminApp } from '../AdminApp.js';

const baseUrl = import.meta.env.VITE_API_BASE_URL;

const root = createRoot(document.getElementById('root')!);

if (!baseUrl) {
    root.render(
        <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', color: '#ef4444' }}>
            <h2>Missing environment variable</h2>
            <p><code>VITE_API_BASE_URL</code> is not defined.</p>
            <p>Create a <code>.env.local</code> file in this package with:</p>
            <pre style={{ background: '#f3f4f6', padding: '1rem', borderRadius: '8px', color: '#111827' }}>
VITE_API_BASE_URL=http://localhost:3000/api</pre>
        </div>,
    );
} else {
    root.render(
        <StrictMode>
            <AdminApp baseUrl={baseUrl} />
        </StrictMode>,
    );
}
