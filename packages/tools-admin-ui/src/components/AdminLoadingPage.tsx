import { BrandedLoadingIndicator } from '@vertesia/ui/shell';

/** Shared placeholder for startup and resource-page loads; inherits the host shell's branding. */
export function AdminLoadingPage({ fullPage = false }: { fullPage?: boolean }) {
    return (
        <div
            className={`flex flex-1 items-center justify-center bg-background text-foreground ${fullPage ? 'min-h-dvh' : 'min-h-64'}`}
        >
            <BrandedLoadingIndicator />
        </div>
    );
}
