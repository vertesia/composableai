import { useUserSession } from '@vertesia/ui/session'

const allowedOrgs = import.meta.env.VITE_VERTESIA_ALLOWED_ORGS
    ? new Set(import.meta.env.VITE_VERTESIA_ALLOWED_ORGS.split(',').map((s: string) => s.trim()).filter(Boolean))
    : null;

export function OrgGate({ children }: { children: React.ReactNode }) {
    const session = useUserSession();
    if (allowedOrgs && !allowedOrgs.has(session.account?.id)) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: '2rem' }}>
                <div style={{ textAlign: 'center', maxWidth: '480px' }}>
                    <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Access Denied</h1>
                    <p style={{ color: '#666' }}>
                        Organization <strong>{session.account?.name}</strong> is not authorized to access this application.
                    </p>
                </div>
            </div>
        );
    }
    return <>{children}</>;
}
