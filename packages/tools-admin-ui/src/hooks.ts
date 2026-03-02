/**
 * Data fetching hooks for the admin panel.
 */

import { useCallback, useEffect, useState } from 'react';
import { useFetch } from '@vertesia/ui/core';
import type { ServerInfo, ResourceData } from './types.js';
import { buildResourceData } from './types.js';

/* ── Theme ───────────────────────────────────────────────────────── */

export type VtaTheme = 'light' | 'dark' | 'system';

const VTA_THEME_KEY = 'vta-theme';

function readStoredTheme(): VtaTheme {
    try {
        const v = localStorage.getItem(VTA_THEME_KEY);
        if (v === 'light' || v === 'dark' || v === 'system') return v;
    } catch { /* SSR / restricted storage */ }
    return 'system';
}

/**
 * Manages the admin-panel theme (light / dark / system).
 * Persists the choice in localStorage and listens for OS changes.
 */
export function useVtaTheme() {
    const [theme, setThemeRaw] = useState<VtaTheme>(readStoredTheme);
    const [systemDark, setSystemDark] = useState(
        () => window.matchMedia('(prefers-color-scheme: dark)').matches,
    );

    useEffect(() => {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    const isDark = theme === 'system' ? systemDark : theme === 'dark';

    const setTheme = useCallback((t: VtaTheme) => {
        try { localStorage.setItem(VTA_THEME_KEY, t); } catch { /* ignore */ }
        setThemeRaw(t);
    }, []);

    return { theme, isDark, setTheme } as const;
}

/**
 * Fetches the tool server info (message, version, endpoints).
 */
export function useServerInfo(baseUrl: string) {
    return useFetch<ServerInfo>(() =>
        fetch(baseUrl).then(r => r.json()),
        [baseUrl]
    );
}

/**
 * Fetches all 5 resource endpoints in parallel and builds collections + flat resource list.
 * MCP endpoints are passed separately since they come from serverInfo.
 */
export function useResourceData(baseUrl: string, mcpEndpoints?: string[]) {
    return useFetch<ResourceData>(() => {
        const fetchJson = (path: string) => fetch(`${baseUrl}/${path}`).then(r => r.json());
        return Promise.all([
            fetchJson('interactions'),
            fetchJson('tools'),
            fetchJson('skills'),
            fetchJson('types'),
            fetchJson('templates'),
        ]).then(([interactions, tools, skills, types, templates]) =>
            buildResourceData(interactions, tools, skills, types, templates, mcpEndpoints)
        );
    }, [baseUrl, mcpEndpoints]);
}
