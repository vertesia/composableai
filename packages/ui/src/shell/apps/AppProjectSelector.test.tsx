// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ProjectRef } from '@vertesia/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const projects: ProjectRef[] = [
    { id: 'project-a', name: 'Project A', account: 'account-1' },
    { id: 'project-b', name: 'Project B', account: 'account-1' },
];

const session = { project: { id: 'project-a' }, client: {} };
const rememberScopeSelection = vi.fn();

vi.mock('@vertesia/ui/session', () => ({
    useUserSession: () => session,
    rememberScopeSelection: (...args: unknown[]) => rememberScopeSelection(...args),
}));

vi.mock('@vertesia/ui/core', () => ({
    errorMessage: (error: unknown) => String(error),
    useFetch: () => ({ data: projects, error: undefined }),
    SelectBox: ({
        value,
        options,
        onChange,
    }: {
        value?: ProjectRef;
        options: ProjectRef[];
        onChange: (option: ProjectRef) => void;
    }) => (
        <select
            aria-label="project"
            value={value?.id ?? ''}
            onChange={(e) => {
                const option = options.find((o) => o.id === e.target.value);
                if (option) onChange(option);
            }}
        >
            <option value="">none</option>
            {options.map((o) => (
                <option key={o.id} value={o.id}>
                    {o.name}
                </option>
            ))}
        </select>
    ),
}));

const { AppProjectSelector } = await import('./AppProjectSelector');

describe('AppProjectSelector', () => {
    const assign = vi.fn();

    beforeEach(() => {
        session.project = { id: 'project-a' };
        vi.stubGlobal('location', { href: 'https://app.example.test/apps/app?tab=runs', assign });
    });

    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
        vi.clearAllMocks();
    });

    function select() {
        return screen.getByRole('combobox', { name: 'project' }) as HTMLSelectElement;
    }

    it("shows the session's project and follows it when the session changes", async () => {
        const { rerender } = render(<AppProjectSelector app={{ name: 'app' }} />);
        await waitFor(() => expect(select().value).toBe('project-a'));

        session.project = { id: 'project-b' };
        rerender(<AppProjectSelector app={{ name: 'app' }} />);
        expect(select().value).toBe('project-b');
    });

    it('loads the page in the picked project, overriding configured defaults through the URL', () => {
        render(<AppProjectSelector app={{ name: 'app' }} />);
        fireEvent.change(select(), { target: { value: 'project-b' } });

        expect(rememberScopeSelection).toHaveBeenCalledWith('account-1', 'project-b');
        expect(assign).toHaveBeenCalledWith('https://app.example.test/apps/app?tab=runs&a=account-1&p=project-b');
    });

    it('does nothing when the current project is picked again', () => {
        const onChange = vi.fn();
        render(<AppProjectSelector app={{ name: 'app' }} onChange={onChange} />);
        fireEvent.change(select(), { target: { value: '' } });
        fireEvent.change(select(), { target: { value: 'project-a' } });

        expect(onChange).not.toHaveBeenCalled();
        expect(assign).not.toHaveBeenCalled();
    });

    it('keeps showing the session project when a handler takes over the switch', () => {
        const onChange = vi.fn(() => false);
        render(<AppProjectSelector app={{ name: 'app' }} onChange={onChange} />);
        fireEvent.change(select(), { target: { value: 'project-b' } });

        expect(onChange).toHaveBeenCalledWith(projects[1]);
        expect(assign).not.toHaveBeenCalled();
        expect(select().value).toBe('project-a');
    });

    it('runs the default switch when the handler returns true', () => {
        render(<AppProjectSelector app={{ name: 'app' }} onChange={() => true} />);
        fireEvent.change(select(), { target: { value: 'project-b' } });

        expect(rememberScopeSelection).toHaveBeenCalledWith('account-1', 'project-b');
        expect(assign).toHaveBeenCalledOnce();
    });
});
