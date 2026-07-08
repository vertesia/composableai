import { render } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Capture the props the wrapper forwards to the underlying react-resizable-panels
// primitive, and stub out its layout machinery so the assertions run in jsdom.
const mocks = vi.hoisted(() => ({ panelProps: vi.fn() }));

vi.mock('react-resizable-panels', () => ({
    Group: ({ children }: { children?: React.ReactNode }) => <div data-testid="group">{children}</div>,
    Panel: (props: Record<string, unknown>) => {
        mocks.panelProps(props);
        return <div data-testid="panel" />;
    },
    Separator: ({ children }: { children?: React.ReactNode }) => <div data-testid="separator">{children}</div>,
}));

import { ResizablePanel, ResizablePanelGroup } from './resizeable';

function forwardedPanelProps() {
    return mocks.panelProps.mock.calls[0]?.[0] as Record<string, unknown>;
}

describe('ResizablePanel size coercion', () => {
    beforeEach(() => {
        mocks.panelProps.mockClear();
    });

    // Regression guard for the react-resizable-panels v3 -> v4 upgrade: v4 treats bare
    // numeric sizes as PIXELS (v3 and below treated them as percentages). Every call site
    // passes percentage-intended numbers, so the wrapper must re-add the "%" unit — without
    // it, panels get clamped to a few pixels and the split can no longer be resized.
    it('coerces bare numeric sizes to percentage strings', () => {
        render(
            <ResizablePanelGroup direction="horizontal">
                <ResizablePanel defaultSize={50} minSize={20} maxSize={80} collapsedSize={5} />
            </ResizablePanelGroup>,
        );

        expect(mocks.panelProps).toHaveBeenCalledTimes(1);
        expect(forwardedPanelProps()).toMatchObject({
            defaultSize: '50%',
            minSize: '20%',
            maxSize: '80%',
            collapsedSize: '5%',
        });
    });

    it('passes explicit unit strings through unchanged', () => {
        render(
            <ResizablePanelGroup direction="horizontal">
                <ResizablePanel defaultSize="300px" minSize="10rem" maxSize="50%" />
            </ResizablePanelGroup>,
        );

        expect(mocks.panelProps).toHaveBeenCalledTimes(1);
        expect(forwardedPanelProps()).toMatchObject({
            defaultSize: '300px',
            minSize: '10rem',
            maxSize: '50%',
        });
    });

    it('leaves unspecified sizes undefined', () => {
        render(
            <ResizablePanelGroup direction="horizontal">
                <ResizablePanel />
            </ResizablePanelGroup>,
        );

        expect(mocks.panelProps).toHaveBeenCalledTimes(1);
        const props = forwardedPanelProps();
        expect(props.defaultSize).toBeUndefined();
        expect(props.minSize).toBeUndefined();
        expect(props.maxSize).toBeUndefined();
    });
});
