import { act, render, screen } from '@testing-library/react';
import type { Notification } from '@vertesia/common';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    AcknowledgeOnRender,
    NotificationAcknowledgementContext,
    type NotificationAcknowledgementRegistry,
    type NotificationOccurrence,
    useAcknowledgeOnRender,
    useOnNotification,
} from './NotificationAcknowledgement';

class FakeIntersectionObserver {
    static instances: FakeIntersectionObserver[] = [];
    readonly targets: Element[] = [];
    disconnected = false;
    constructor(readonly callback: IntersectionObserverCallback) {
        FakeIntersectionObserver.instances.push(this);
    }
    observe(target: Element) {
        this.targets.push(target);
    }
    unobserve() {}
    disconnect() {
        this.disconnected = true;
    }
    takeRecords(): IntersectionObserverEntry[] {
        return [];
    }
    fire(isIntersecting: boolean) {
        act(() => {
            this.callback(
                this.targets.map((target) => ({ isIntersecting, target }) as IntersectionObserverEntry),
                this as unknown as IntersectionObserver,
            );
        });
    }
}

let visibility: DocumentVisibilityState = 'visible';

function setVisibility(state: DocumentVisibilityState) {
    visibility = state;
    act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
    });
}

function createRegistry() {
    const calls: [string, boolean][] = [];
    const listeners = new Set<(n: Notification) => void>();
    const registry: NotificationAcknowledgementRegistry = {
        register: (occurrence, visible) => calls.push([`${occurrence.type}:${occurrence.id}`, visible]),
        onNotification: (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
    return { registry, calls, listeners };
}

function Probe({ occurrence }: { occurrence?: NotificationOccurrence | NotificationOccurrence[] }) {
    const ref = useRef<HTMLDivElement>(null);
    useAcknowledgeOnRender(occurrence, ref);
    return <div ref={ref}>probe</div>;
}

beforeEach(() => {
    FakeIntersectionObserver.instances = [];
    visibility = 'visible';
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('useAcknowledgeOnRender', () => {
    it('does nothing without a provider', () => {
        render(<Probe occurrence={{ type: 'task', id: 't1' }} />);
        expect(FakeIntersectionObserver.instances).toHaveLength(0);
    });

    it('reports visibility while the element intersects and the tab is visible', () => {
        const { registry, calls } = createRegistry();
        const { unmount } = render(
            <NotificationAcknowledgementContext.Provider value={registry}>
                <Probe occurrence={{ type: 'task', id: 't1' }} />
            </NotificationAcknowledgementContext.Provider>,
        );
        const observer = FakeIntersectionObserver.instances[0];
        expect(calls).toEqual([]);

        observer.fire(true);
        expect(calls).toEqual([['task:t1', true]]);

        setVisibility('hidden');
        expect(calls).toEqual([
            ['task:t1', true],
            ['task:t1', false],
        ]);

        setVisibility('visible');
        unmount();
        expect(calls).toEqual([
            ['task:t1', true],
            ['task:t1', false],
            ['task:t1', true],
            ['task:t1', false],
        ]);
        expect(observer.disconnected).toBe(true);
    });

    it('does not report an element that intersects in a hidden tab', () => {
        const { registry, calls } = createRegistry();
        visibility = 'hidden';
        render(
            <NotificationAcknowledgementContext.Provider value={registry}>
                <Probe occurrence={{ type: 'object', id: 'o1' }} />
            </NotificationAcknowledgementContext.Provider>,
        );
        FakeIntersectionObserver.instances[0].fire(true);
        expect(calls).toEqual([]);
    });

    it('reports every occurrence of a list and pairs each report on unmount', () => {
        const { registry, calls } = createRegistry();
        const { unmount } = render(
            <NotificationAcknowledgementContext.Provider value={registry}>
                <Probe
                    occurrence={[
                        { type: 'agent_run_end', id: 'r1' },
                        { type: 'agent_turn', id: 'r1' },
                    ]}
                />
            </NotificationAcknowledgementContext.Provider>,
        );
        FakeIntersectionObserver.instances[0].fire(true);
        unmount();
        expect(calls).toEqual([
            ['agent_run_end:r1', true],
            ['agent_turn:r1', true],
            ['agent_run_end:r1', false],
            ['agent_turn:r1', false],
        ]);
    });

    it('does not observe when there is nothing to acknowledge', () => {
        const { registry } = createRegistry();
        render(
            <NotificationAcknowledgementContext.Provider value={registry}>
                <Probe />
            </NotificationAcknowledgementContext.Provider>,
        );
        expect(FakeIntersectionObserver.instances).toHaveLength(0);
    });

    it('keeps the same observer when the occurrence is rebuilt with the same content', () => {
        const { registry } = createRegistry();
        const { rerender } = render(
            <NotificationAcknowledgementContext.Provider value={registry}>
                <Probe occurrence={{ type: 'task', id: 't1' }} />
            </NotificationAcknowledgementContext.Provider>,
        );
        rerender(
            <NotificationAcknowledgementContext.Provider value={registry}>
                <Probe occurrence={{ type: 'task', id: 't1' }} />
            </NotificationAcknowledgementContext.Provider>,
        );
        expect(FakeIntersectionObserver.instances).toHaveLength(1);
    });
});

describe('AcknowledgeOnRender', () => {
    it('renders children without a wrapper when no provider is mounted', () => {
        const { container } = render(
            <AcknowledgeOnRender occurrence={{ type: 'task', id: 't1' }}>
                <span>child</span>
            </AcknowledgeOnRender>,
        );
        expect(container.querySelector('[data-notification-ack]')).toBeNull();
        expect(screen.getByText('child')).toBeTruthy();
    });

    it('keeps its wrapper when the occurrence appears later', () => {
        const { registry, calls } = createRegistry();
        const { container, rerender } = render(
            <NotificationAcknowledgementContext.Provider value={registry}>
                <AcknowledgeOnRender occurrence={undefined}>
                    <span>child</span>
                </AcknowledgeOnRender>
            </NotificationAcknowledgementContext.Provider>,
        );
        const wrapper = container.querySelector('[data-notification-ack]');
        expect(wrapper).not.toBeNull();
        rerender(
            <NotificationAcknowledgementContext.Provider value={registry}>
                <AcknowledgeOnRender occurrence={{ type: 'agent_turn', id: 'r1' }}>
                    <span>child</span>
                </AcknowledgeOnRender>
            </NotificationAcknowledgementContext.Provider>,
        );
        expect(container.querySelector('[data-notification-ack]')).toBe(wrapper);
        FakeIntersectionObserver.instances[0].fire(true);
        expect(calls).toEqual([['agent_turn:r1', true]]);
    });
});

describe('useOnNotification', () => {
    function Listener({ onNotification }: { onNotification: (n: Notification) => void }) {
        useOnNotification(onNotification);
        return null;
    }

    it('subscribes while mounted', () => {
        const { registry, listeners } = createRegistry();
        const received: string[] = [];
        const { unmount } = render(
            <NotificationAcknowledgementContext.Provider value={registry}>
                <Listener onNotification={(n) => received.push(n.id)} />
            </NotificationAcknowledgementContext.Provider>,
        );
        expect(listeners.size).toBe(1);
        for (const listener of listeners) listener({ id: 'n1' } as Notification);
        expect(received).toEqual(['n1']);
        unmount();
        expect(listeners.size).toBe(0);
    });

    it('is a no-op without a provider', () => {
        expect(() => render(<Listener onNotification={() => {}} />)).not.toThrow();
    });
});
