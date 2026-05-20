export function resolveAppApiBaseUrl() {
    const configured = import.meta.env.VITE_APP_API_BASE_URL ?? import.meta.env.VITE_APP_API_BASE;
    if (configured) return configured.replace(/\/+$/, '');

    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts[0] === 'live' && parts[1]) {
        return `/live/${parts[1]}/api`;
    }
    if (parts[0] === 'tenants' && parts[2] === 'live' && parts[3]) {
        return `/${parts.slice(0, 4).join('/')}/api`;
    }
    if (parts[0] === 'tenants' && parts[2] === 'apps' && parts[4] === 'versions' && parts[5]) {
        return `/${parts.slice(0, 6).join('/')}/api`;
    }
    return '/api';
}
