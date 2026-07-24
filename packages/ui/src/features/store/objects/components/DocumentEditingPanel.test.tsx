/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ContentObject, Project } from '@vertesia/common';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../../i18n/index.js';
import { type DocumentEditingModelConfiguration, DocumentEditingWorkspace } from './DocumentEditingPanel.js';

const mocks = vi.hoisted(() => {
    const retrieveProject = vi.fn();
    const startAgent = vi.fn();
    return {
        findRun: vi.fn(),
        resolveTarget: vi.fn(),
        retrieveProject,
        startAgent,
        session: {
            client: {
                agents: {
                    start: startAgent,
                    terminate: vi.fn(),
                },
                files: {},
                projects: { retrieve: retrieveProject },
            },
            project: { id: 'project-1' },
            store: { objects: {} },
            user: { sub: 'user-1' },
        },
    };
});

vi.mock('@vertesia/ui/core', () => ({
    Button: ({
        children,
        className,
        disabled,
        onClick,
        type,
        'aria-label': ariaLabel,
    }: {
        children?: ReactNode;
        className?: string;
        disabled?: boolean;
        onClick?: () => void;
        type?: 'button' | 'submit' | 'reset';
        'aria-label'?: string;
    }) => (
        <button
            type={type ?? 'button'}
            className={className}
            disabled={disabled}
            onClick={onClick}
            aria-label={ariaLabel}
        >
            {children}
        </button>
    ),
    Center: ({ children, className }: { children?: ReactNode; className?: string }) => (
        <div className={className}>{children}</div>
    ),
    ConfirmModal: () => null,
    errorMessage: (_error: unknown, fallback: string) => fallback,
    Modal: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    ResizableHandle: () => <div />,
    ResizablePanel: ({ children, className }: { children?: ReactNode; className?: string }) => (
        <div className={className}>{children}</div>
    ),
    ResizablePanelGroup: ({ children, className }: { children?: ReactNode; className?: string }) => (
        <div className={className}>{children}</div>
    ),
    Spinner: () => <span>Loading</span>,
    useToast: () => vi.fn(),
    VTooltip: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

vi.mock('@vertesia/ui/session', () => ({
    useUserSession: () => mocks.session,
}));

vi.mock('@vertesia/ui/widgets', () => ({
    ArtifactEditingSurface: () => <div data-testid="artifact-editing-surface" />,
    createUnifiedLineDiff: vi.fn(() => ''),
    diffTextSegments: vi.fn(() => []),
    isArtifactRefreshEvent: vi.fn(() => false),
}));

vi.mock('../../../agent/chat/ModernAgentConversation.js', () => ({
    ModernAgentConversation: ({ agentRunId }: { agentRunId?: string }) => (
        <div data-testid="agent-conversation" data-agent-run-id={agentRunId} />
    ),
}));

vi.mock('./DocumentEditingConfigurationSelector.js', () => ({
    DocumentEditingConfigurationSelector: ({
        value,
    }: {
        value: { environment?: string; model?: string; model_options?: Record<string, unknown> };
    }) => (
        <div
            data-testid="editing-configuration"
            data-environment={value.environment}
            data-model={value.model}
            data-model-options={JSON.stringify(value.model_options)}
        />
    ),
    getDocumentEditingProjectDefault: (project: Pick<Project, 'configuration'>) => {
        const defaults = project.configuration?.defaults?.system?.agent ?? project.configuration?.defaults?.base;
        return { environment: defaults?.environment, model: defaults?.model };
    },
}));

vi.mock('./documentEditingRun.js', () => ({
    DOCUMENT_EDITING_DEFAULT_INTERACTION: 'sys:conversation',
    createDocumentEditingRunIdentity: () => ({ tags: ['document-editing'], properties: {} }),
    findDocumentEditingRun: mocks.findRun,
}));

vi.mock('./documentEditingTarget.js', () => ({
    resolveDocumentEditingTarget: mocks.resolveTarget,
}));

vi.mock('./SaveVersionConfirmModal.js', () => ({
    SaveVersionConfirmModal: () => null,
}));

const object = {
    id: 'document-1',
    name: 'Editing test',
    content: {
        etag: 'etag-1',
        name: 'document.md',
        type: 'text/markdown',
    },
} as unknown as ContentObject;

function renderWorkspace(props?: { model?: DocumentEditingModelConfiguration; startImmediately?: boolean }) {
    return render(
        <I18nProvider lng="en">
            <DocumentEditingWorkspace object={object} initialContent="# Editing test" {...props} />
        </I18nProvider>,
    );
}

describe('DocumentEditingWorkspace startup configuration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.findRun.mockResolvedValue(undefined);
        mocks.resolveTarget.mockResolvedValue({ id: 'document-1', etag: 'etag-1', content: '# Editing test' });
        mocks.retrieveProject.mockResolvedValue({
            configuration: {
                defaults: {
                    system: { agent: { environment: 'project-environment', model: 'project-model' } },
                },
            },
        });
        mocks.startAgent.mockResolvedValue({ id: 'run-1' });
    });

    afterEach(cleanup);

    it('starts immediately with the host-provided model configuration', async () => {
        renderWorkspace({
            model: {
                env: 'app-environment',
                model: 'app-model',
                options: { _option_id: 'openai-text', temperature: 0.2 },
            },
            startImmediately: true,
        });

        await waitFor(() => expect(mocks.startAgent).toHaveBeenCalledTimes(1));

        expect(mocks.retrieveProject).not.toHaveBeenCalled();
        expect(mocks.startAgent.mock.calls[0]?.[0]).toMatchObject({
            config: {
                environment: 'app-environment',
                model: 'app-model',
                model_options: { _option_id: 'openai-text', temperature: 0.2 },
            },
            interaction: 'sys:conversation',
            tool_approval_mode: 'full_control',
        });
        expect((await screen.findByTestId('agent-conversation')).getAttribute('data-agent-run-id')).toBe('run-1');
    });

    it('keeps startup manual when startImmediately is omitted', async () => {
        renderWorkspace({
            model: {
                env: 'app-environment',
                model: 'app-model',
                options: { _option_id: 'openai-text', temperature: 0.2 },
            },
        });

        const startButton = await screen.findByRole('button', { name: 'Start editing' });
        await waitFor(() => expect((startButton as HTMLButtonElement).disabled).toBe(false));
        expect(mocks.startAgent).not.toHaveBeenCalled();

        fireEvent.click(startButton);

        await waitFor(() => expect(mocks.startAgent).toHaveBeenCalledTimes(1));
        expect(mocks.startAgent.mock.calls[0]?.[0]).toMatchObject({
            config: {
                environment: 'app-environment',
                model: 'app-model',
                model_options: { _option_id: 'openai-text', temperature: 0.2 },
            },
        });
    });

    it('uses project defaults when the host does not provide a model configuration', async () => {
        renderWorkspace();

        const startButton = await screen.findByRole('button', { name: 'Start editing' });
        await waitFor(() => expect((startButton as HTMLButtonElement).disabled).toBe(false));

        expect(mocks.retrieveProject).toHaveBeenCalledWith('project-1');
        expect(screen.getByTestId('editing-configuration').getAttribute('data-environment')).toBe(
            'project-environment',
        );
        expect(screen.getByTestId('editing-configuration').getAttribute('data-model')).toBe('project-model');
    });

    it('does not duplicate automatic startup for equivalent inline model objects', async () => {
        let resolveStart: ((run: { id: string }) => void) | undefined;
        mocks.startAgent.mockImplementation(
            () =>
                new Promise<{ id: string }>((resolve) => {
                    resolveStart = resolve;
                }),
        );

        const firstProps = {
            model: {
                env: 'app-environment',
                model: 'app-model',
                options: { _option_id: 'openai-text' as const, temperature: 0.2 },
            },
            startImmediately: true,
        };
        const view = renderWorkspace(firstProps);

        await waitFor(() => expect(mocks.startAgent).toHaveBeenCalledTimes(1));

        view.rerender(
            <I18nProvider lng="en">
                <DocumentEditingWorkspace
                    object={object}
                    initialContent="# Editing test"
                    model={{
                        env: 'app-environment',
                        model: 'app-model',
                        options: { _option_id: 'openai-text', temperature: 0.2 },
                    }}
                    startImmediately
                />
            </I18nProvider>,
        );
        await waitFor(() => expect(mocks.startAgent).toHaveBeenCalledTimes(1));

        resolveStart?.({ id: 'run-1' });
        await waitFor(() =>
            expect(screen.getByTestId('agent-conversation').getAttribute('data-agent-run-id')).toBe('run-1'),
        );
    });

    it('uses changed model options as a new automatic-start identity', async () => {
        mocks.startAgent.mockRejectedValueOnce(new Error('temporary failure')).mockResolvedValueOnce({ id: 'run-2' });
        const view = renderWorkspace({
            model: {
                env: 'app-environment',
                model: 'app-model',
                options: { _option_id: 'openai-text', temperature: 0.2 },
            },
            startImmediately: true,
        });

        await waitFor(() => expect(mocks.startAgent).toHaveBeenCalledTimes(1));

        view.rerender(
            <I18nProvider lng="en">
                <DocumentEditingWorkspace
                    object={object}
                    initialContent="# Editing test"
                    model={{
                        env: 'app-environment',
                        model: 'app-model',
                        options: { _option_id: 'openai-text', temperature: 0.4 },
                    }}
                    startImmediately
                />
            </I18nProvider>,
        );

        await waitFor(() => expect(mocks.startAgent).toHaveBeenCalledTimes(2));
        expect(mocks.startAgent.mock.calls[1]?.[0]).toMatchObject({
            config: {
                environment: 'app-environment',
                model: 'app-model',
                model_options: { _option_id: 'openai-text', temperature: 0.4 },
            },
        });
    });

    it('restores model options when reattaching to an existing run', async () => {
        mocks.findRun.mockResolvedValue({
            id: 'existing-run',
            config: {
                environment: 'run-environment',
                model: 'run-model',
                model_options: { _option_id: 'openai-text', temperature: 0.2 },
            },
        });

        renderWorkspace({
            model: {
                env: 'host-environment',
                model: 'host-model',
                options: { _option_id: 'openai-text', temperature: 0.4 },
            },
            startImmediately: true,
        });

        await waitFor(() =>
            expect(screen.getByTestId('agent-conversation').getAttribute('data-agent-run-id')).toBe('existing-run'),
        );
        expect(mocks.startAgent).not.toHaveBeenCalled();
        expect(screen.getByTestId('editing-configuration').getAttribute('data-environment')).toBe('run-environment');
        expect(screen.getByTestId('editing-configuration').getAttribute('data-model')).toBe('run-model');
        expect(screen.getByTestId('editing-configuration').getAttribute('data-model-options')).toBe(
            JSON.stringify({ _option_id: 'openai-text', temperature: 0.2 }),
        );
    });
});
