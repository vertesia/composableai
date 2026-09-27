import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ContentTypeIntakePolicy } from '@vertesia/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../i18n/index.js';
import { IntakePolicyEditor } from './IntakePolicyEditor.js';

vi.mock('@vertesia/ui/session', () => ({
    useUserSession: () => ({ store: {} }),
}));

vi.mock('../../environment/SelectEnvironment.js', () => ({
    SelectEnvironment: () => <div data-testid="environment-selector" />,
    SelectModel: () => <div data-testid="model-selector" />,
}));

function renderEditor(
    value: ContentTypeIntakePolicy,
    onSave = vi.fn(async (policy: ContentTypeIntakePolicy) => policy),
) {
    render(
        <I18nProvider lng="en">
            <IntakePolicyEditor value={value} onSave={onSave} />
        </I18nProvider>,
    );
    return onSave;
}

describe('IntakePolicyEditor memory tab', () => {
    const originalScrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');

    beforeEach(() => {
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
    });

    afterEach(() => {
        if (originalScrollIntoView) {
            Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScrollIntoView);
        } else {
            Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
        }
        vi.clearAllMocks();
    });

    it('saves bounded memory fields while retaining sibling intake policy', async () => {
        const onSave = renderEditor({
            extraction: { enabled: true },
            memory: { enabled: false, config: { environment: 'test-env', model: 'test-model' } },
        });

        fireEvent.click(screen.getByRole('tab', { name: 'Memory' }));
        expect(screen.getByTestId('environment-selector')).toBeTruthy();
        expect(screen.getByTestId('model-selector')).toBeTruthy();
        fireEvent.change(screen.getByRole('spinbutton', { name: 'Maximum entities' }), { target: { value: '0' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(onSave).not.toHaveBeenCalled();

        fireEvent.change(screen.getByRole('spinbutton', { name: 'Maximum entities' }), { target: { value: '25' } });
        fireEvent.change(screen.getByRole('textbox', { name: 'Contribution scope' }), {
            target: { value: 'contract-memory' },
        });

        const entities = screen.getByRole('spinbutton', { name: 'Maximum entities' });
        expect(entities.getAttribute('min')).toBe('1');
        expect(entities.getAttribute('max')).toBe('100');
        const textChars = screen.getByRole('spinbutton', { name: 'Maximum text characters' });
        expect(textChars.getAttribute('min')).toBe('1000');
        expect(textChars.getAttribute('max')).toBe('500000');

        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
        expect(onSave).toHaveBeenCalledWith({
            extraction: { enabled: true },
            memory: {
                enabled: false,
                config: { environment: 'test-env', model: 'test-model' },
                max_entities: 25,
                scope: 'contract-memory',
            },
        });
    });

    it('distinguishes inherited memory from an explicit disable through the keyboard', async () => {
        const onSave = renderEditor({ extraction: { enabled: true }, memory: { enabled: false } });
        const user = userEvent.setup();

        fireEvent.click(screen.getByRole('tab', { name: 'Memory' }));
        const enabled = screen.getByRole('button', { name: 'Enabled' });
        expect(enabled.textContent).toContain('Disabled');
        enabled.focus();
        await user.keyboard('{Enter}');
        await user.click(within(await screen.findByRole('dialog')).getByText('Inherit'));

        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        await waitFor(() => expect(onSave).toHaveBeenCalledWith({ extraction: { enabled: true } }));
    });
});
