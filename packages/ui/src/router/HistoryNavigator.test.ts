import { afterEach, describe, expect, it, vi } from 'vitest';
import { HistoryNavigator } from './HistoryNavigator';

describe('HistoryNavigator link interception', () => {
    afterEach(() => {
        document.body.replaceChildren();
        vi.restoreAllMocks();
    });

    it('leaves targeted internal links to native browser navigation', () => {
        const navigator = new HistoryNavigator();
        const navigate = vi.spyOn(navigator as unknown as { _navigate: () => void }, '_navigate');
        const link = document.createElement('a');
        const icon = document.createElement('span');
        link.href = '/store/executions/run-1?p=project&a=account';
        link.target = '_blank';
        link.append(icon);
        document.body.append(link);
        navigator.start();

        const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
        icon.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(false);
        expect(navigate).not.toHaveBeenCalled();
        navigator.stop();
    });

    it('continues to intercept ordinary same-origin links', () => {
        const navigator = new HistoryNavigator();
        const navigate = vi
            .spyOn(navigator as unknown as { _navigate: () => void }, '_navigate')
            .mockImplementation(() => undefined);
        const link = document.createElement('a');
        const label = document.createElement('span');
        link.href = '/store/executions/run-1';
        link.append(label);
        document.body.append(link);
        navigator.start();

        const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
        label.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect(navigate).toHaveBeenCalledOnce();
        navigator.stop();
    });
});

describe('HistoryNavigator breadcrumb chain', () => {
    const chain = [{ title: 'Agents', href: '/store/agents' }];
    afterEach(() => {
        window.history.replaceState(null, '', '/');
    });

    function chainAfter(options: Parameters<HistoryNavigator['navigate']>[1]) {
        window.history.replaceState({ historyChain: chain }, '', '/page');
        new HistoryNavigator().navigate('/page/next', options);
        return window.history.state.historyChain;
    }

    it('adds a breadcrumb on a push and clears them on a replace', () => {
        expect(chainAfter({})).toHaveLength(2);
        expect(chainAfter({ replace: true })).toEqual([]);
    });

    it('leaves the breadcrumbs as they are with keepHistoryChain', () => {
        const length = window.history.length;
        expect(chainAfter({ replace: true, keepHistoryChain: true })).toEqual(chain);
        expect(window.history.length).toBe(length);
        expect(window.location.pathname).toBe('/page/next');
    });

    it('pushes an entry without a breadcrumb with keepHistoryChain alone', () => {
        const length = window.history.length;
        expect(chainAfter({ keepHistoryChain: true })).toEqual(chain);
        expect(window.history.length).toBe(length + 1);
    });

    it('starts new breadcrumbs on a pushed entry with clearHistoryChain', () => {
        window.history.replaceState({ historyChain: chain }, '', '/page');
        const length = window.history.length;
        new HistoryNavigator().navigate('/page/next', { clearHistoryChain: true });
        expect(window.history.state.historyChain).toEqual([]);
        expect(window.history.length).toBe(length + 1);
    });
});
