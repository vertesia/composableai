import { useUITranslation } from '@vertesia/ui/i18n';
import { useUserSession } from '@vertesia/ui/session';

const allowedOrgs = import.meta.env.VITE_VERTESIA_ALLOWED_ORGS
    ? new Set(
          import.meta.env.VITE_VERTESIA_ALLOWED_ORGS.split(',')
              .map((s: string) => s.trim())
              .filter(Boolean),
      )
    : null;

export function OrgGate({ children }: { children: React.ReactNode }) {
    const session = useUserSession();
    const { t } = useUITranslation();
    if (allowedOrgs && !allowedOrgs.has(session.account?.id)) {
        return (
            <div className="flex h-screen items-center justify-center p-8">
                <div className="max-w-md text-center">
                    <h1 className="mb-2 text-2xl font-semibold">{t('access.denied')}</h1>
                    <p className="text-muted">
                        {t('access.orgNotAuthorized', {
                            name: session.account?.name ?? '',
                            interpolation: { escapeValue: false },
                        })}
                    </p>
                </div>
            </div>
        );
    }
    return <>{children}</>;
}
