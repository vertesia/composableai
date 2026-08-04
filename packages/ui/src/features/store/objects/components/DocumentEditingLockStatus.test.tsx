/** @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../../i18n/index.js';
import { DocumentEditingLockStatus } from './DocumentEditingLockStatus.js';

describe('DocumentEditingLockStatus', () => {
    it('shows the active lock and exposes manual unlock', () => {
        const onToggleLock = vi.fn();
        render(
            <I18nProvider lng="en">
                <DocumentEditingLockStatus isLocked onToggleLock={onToggleLock} />
            </I18nProvider>,
        );

        expect(screen.getByRole('status').textContent).toContain('AI is editing the working copy');
        fireEvent.click(screen.getByRole('button', { name: 'Unlock editing' }));
        expect(onToggleLock).toHaveBeenCalledTimes(1);
    });

    it('warns when editing was manually unlocked and offers relocking', () => {
        render(
            <I18nProvider lng="en">
                <DocumentEditingLockStatus isLocked={false} onToggleLock={vi.fn()} />
            </I18nProvider>,
        );

        expect(screen.getByRole('alert').textContent).toContain('Editing manually unlocked');
        expect(screen.getByRole('button', { name: 'Lock editing' })).not.toBeNull();
    });
});
