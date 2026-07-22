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
