import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import SignInEmailStep from './SignInEmailStep';

const resolveTenant = vi.hoisted(() => vi.fn());
vi.mock('@vertesia/ui/session', () => ({ setFirebaseTenant: resolveTenant }));
vi.mock('@vertesia/ui/i18n', () => ({ useUITranslation: () => ({ t: (key: string) => key }) }));
afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

it('keeps feedback visible and prevents duplicate requests while tenant discovery is pending', async () => {
    let finish!: () => void;
    resolveTenant.mockReturnValue(
        new Promise<void>((resolve) => {
            finish = resolve;
        }),
    );
    const onProceed = vi.fn();
    render(<SignInEmailStep initialEmail="person@example.com" onProceed={onProceed} />);
    const button = screen.getByRole('button', { name: 'auth.continue' });
    fireEvent.click(button);
    expect(screen.queryByRole('button', { name: 'auth.continue' })).toBeNull();
    expect(screen.getByRole('textbox')).toBeTruthy();
    expect(screen.getByRole('status')).toBeTruthy();
    expect(button.contains(screen.getByRole('status'))).toBe(false);
    fireEvent.submit(screen.getByRole('textbox').closest('form')!);
    expect(resolveTenant).toHaveBeenCalledTimes(1);
    finish();
    await waitFor(() => expect(onProceed).toHaveBeenCalledWith('person@example.com', undefined));
});
