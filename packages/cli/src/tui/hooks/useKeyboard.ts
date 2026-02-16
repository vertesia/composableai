import { useInput } from 'ink';
import { useNavigation } from '../context/NavigationContext.js';
import type { ScreenName } from '../context/NavigationContext.js';

const TAB_SCREENS: ScreenName[] = ['home', 'agent-list', 'run-history', 'documents', 'skills'];

/**
 * Global keyboard handler for navigation shortcuts.
 * - Tab/Shift+Tab: cycle between main tabs
 * - 1-5: jump to tab by number
 * - Esc: go back
 * - q: quit (handled by ink's exitOnCtrlC)
 */
export function useKeyboard() {
    const { current, navigate, goBack, canGoBack } = useNavigation();

    useInput((input, key) => {
        // Number keys jump to tabs
        const num = parseInt(input, 10);
        if (num >= 1 && num <= TAB_SCREENS.length) {
            navigate(TAB_SCREENS[num - 1]);
            return;
        }

        // Tab / Shift+Tab cycle
        if (key.tab) {
            const currentIdx = TAB_SCREENS.indexOf(current.name);
            if (currentIdx >= 0) {
                const nextIdx = key.shift
                    ? (currentIdx - 1 + TAB_SCREENS.length) % TAB_SCREENS.length
                    : (currentIdx + 1) % TAB_SCREENS.length;
                navigate(TAB_SCREENS[nextIdx]);
            }
            return;
        }

        // Escape goes back
        if (key.escape && canGoBack) {
            goBack();
            return;
        }
    });
}
