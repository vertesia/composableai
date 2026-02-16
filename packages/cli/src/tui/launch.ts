/**
 * Dynamic entry point for the ink-based TUI.
 * Separated so React/ink are only loaded when needed.
 */
export async function launchTui() {
    const React = await import('react');
    const { render } = await import('ink');
    const { App } = await import('./App.js');

    const { waitUntilExit } = render(React.createElement(App));
    await waitUntilExit();
}
