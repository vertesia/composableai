import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DefaultPermissionLoadingScreen } from '@vertesia/ui/features';
import { i18nInstance, NAMESPACE, useUITranslation } from '@vertesia/ui/i18n';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    AppBrandingProvider,
    BrandedAuthLoadingScreen,
    BrandedPermissionLoadingScreen,
    BrandedSignInScreen,
} from './BrandedAuthScreens';
import { SignInFlowSteps, useSignInFlow } from './login/SignInFlow';
import { DefaultSignInScreen, type SignInRecoveryMode } from './login/SigninScreen';
import { DefaultAuthLoadingScreen } from './SplashScreen';

afterEach(() => {
    cleanup();
    localStorage.clear();
});

function CopyProbe() {
    const { t } = useUITranslation();
    return <span>{t('auth.email.title')}</span>;
}

function SignInPreview() {
    const flow = useSignInFlow<SignInRecoveryMode>();
    return (
        <BrandedSignInScreen
            flow={flow}
            notice={null}
            isNested={false}
            onRetry={vi.fn()}
            onUseDifferentAccount={vi.fn()}
            onContinueWithSanitizedScope={vi.fn()}
            onSignup={vi.fn()}
        >
            <SignInFlowSteps flow={flow} />
        </BrandedSignInScreen>
    );
}

describe('configuration-driven auth screens', () => {
    it('keeps brand copy local to each shell and preserves the shared translations', () => {
        const original = i18nInstance.t('auth.email.title', { ns: NAMESPACE });
        render(
            <>
                <AppBrandingProvider branding={{ name: 'One', copy: { welcome: 'Welcome to One' } }}>
                    <CopyProbe />
                </AppBrandingProvider>
                <AppBrandingProvider branding={{ name: 'Two', copy: { welcome: 'Welcome to Two' } }}>
                    <CopyProbe />
                </AppBrandingProvider>
                <CopyProbe />
            </>,
        );
        expect(screen.getByText('Welcome to One')).toBeTruthy();
        expect(screen.getByText('Welcome to Two')).toBeTruthy();
        expect(screen.getByText(original)).toBeTruthy();
        expect(i18nInstance.t('auth.email.title', { ns: NAMESPACE })).toBe(original);
    });

    it('brands the existing email form without replacing its validation', () => {
        render(
            <AppBrandingProvider
                branding={{
                    name: 'Workspace',
                    copy: { welcome: 'Welcome here', emailPlaceholder: 'you@example.test' },
                }}
            >
                <SignInPreview />
            </AppBrandingProvider>,
        );
        expect(screen.getByRole('heading', { name: 'Welcome here' })).toBeTruthy();
        expect(screen.getByPlaceholderText('you@example.test')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        expect(screen.getByRole('textbox').getAttribute('aria-invalid')).toBe('true');
    });

    it('uses shared branding for loading and preserves permission recovery actions', () => {
        const retry = vi.fn();
        const brand = { name: 'Workspace', copy: { loading: 'Preparing Workspace' } };
        const view = render(
            <AppBrandingProvider branding={brand}>
                <BrandedAuthLoadingScreen />
            </AppBrandingProvider>,
        );
        expect(screen.getByRole('status').getAttribute('aria-label')).toBe('Preparing Workspace');
        view.rerender(
            <AppBrandingProvider branding={brand}>
                <BrandedPermissionLoadingScreen
                    status="error"
                    title="Access failed"
                    description="Try again"
                    actionLabel="Retry"
                    onAction={retry}
                />
            </AppBrandingProvider>,
        );
        expect(screen.getByRole('alert').textContent).toContain('Access failed');
        fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
        expect(retry).toHaveBeenCalledOnce();
    });
});

describe('default layout parity', () => {
    it('retains the default sign-in chrome and legal footer with empty branding', () => {
        const view = render(
            <DefaultSignInScreen>
                <p>Form</p>
            </DefaultSignInScreen>,
        );
        const expected = view.container.innerHTML;
        view.rerender(
            <AppBrandingProvider branding={{ name: 'Test' }}>
                <BrandedSignInScreen
                    {...({ isNested: false, children: <p>Form</p> } as Parameters<typeof BrandedSignInScreen>[0])}
                />
            </AppBrandingProvider>,
        );
        expect(view.container.querySelector('[data-vbrand] > div')?.outerHTML).toBe(expected);
    });
    it('uses the same loading markup with no branding assets or copy', () => {
        const view = render(<DefaultAuthLoadingScreen />);
        const expected = view.container.innerHTML;
        view.rerender(
            <AppBrandingProvider branding={{ name: 'Test' }}>
                <BrandedAuthLoadingScreen />
            </AppBrandingProvider>,
        );
        expect(view.container.querySelector('[role="status"]')?.outerHTML).toBe(expected);
    });
    it('preserves permission error details and the outline recovery button', () => {
        const props = {
            status: 'error' as const,
            title: 'Failed',
            description: 'Retry',
            actionLabel: 'Retry',
            onAction: vi.fn(),
            error: new Error('Details'),
        };
        const view = render(<DefaultPermissionLoadingScreen {...props} />);
        const expected = view.container.innerHTML;
        view.rerender(
            <AppBrandingProvider branding={{ name: 'Test' }}>
                <BrandedPermissionLoadingScreen {...props} />
            </AppBrandingProvider>,
        );
        expect(view.container.querySelector('[data-vbrand] > div')?.outerHTML).toBe(expected);
    });
});
