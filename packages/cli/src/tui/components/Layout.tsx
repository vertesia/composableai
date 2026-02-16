import type { ReactNode } from 'react';
import { Box } from 'ink';
import { NavBar } from './NavBar.js';
import { StatusBar } from './StatusBar.js';

interface LayoutProps {
    children: ReactNode;
}

/**
 * Full-screen layout frame: NavBar at top, main content, StatusBar at bottom.
 */
export function Layout({ children }: LayoutProps) {
    return (
        <Box flexDirection="column" width="100%">
            <NavBar />
            <Box flexDirection="column" flexGrow={1} paddingX={1} paddingY={1}>
                {children}
            </Box>
            <StatusBar />
        </Box>
    );
}
