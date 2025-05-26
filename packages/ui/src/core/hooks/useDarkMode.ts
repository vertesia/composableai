import { useEffect } from "react";

export function useDarkMode(cb: (isDarkMode: boolean) => unknown) {
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const _cb = (e: MediaQueryListEvent) => cb(e.matches);
        mediaQuery.addEventListener('change', _cb);
        cb(mediaQuery.matches);
        return () => mediaQuery.removeEventListener('change', _cb);
    }, []);
}
