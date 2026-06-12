import { useCallback, useState } from 'react';
import { Portal } from '../Portal.js';
import { NotificationPanel } from './NotificationPanel.js';
import { ToastContext } from './ToastContext.js';
import type { ToastProps } from './ToastProps.js';

interface ToastProviderProps {
    children: React.ReactNode | React.ReactNode[];
}
export function ToastProvider({ children }: ToastProviderProps) {
    const [data, setData] = useState<ToastProps | null>(null);

    // Stable reference: consumers (`useToast`) place this fn in useEffect /
    // useCallback dep arrays. Without useCallback, ToastProvider re-renders
    // (e.g. after setData fires from a `toast(...)` call) produce a NEW fn
    // identity, cascading into broken-effect loops in callers — most notably
    // DocumentUploadModal's `processFiles` useCallback, which would re-fire
    // its open-effect on every toast, looping POST /api/v1/objects/find.
    const toast = useCallback((next: ToastProps | null) => {
        setData(next);
    }, []);

    return (
        <>
            <ToastContext.Provider value={toast}>{children}</ToastContext.Provider>
            {data && (
                <Portal>
                    <NotificationPanel data={data} onClose={() => toast(null)} />
                </Portal>
            )}
        </>
    );
}
