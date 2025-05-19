import { useState } from "react";
import { Portal } from "../Portal.js";
import { NotificationPanel } from "./NotificationPanel.js";
import { ToastContext } from "./ToastContext.js";
import { ToastProps } from "./ToastProps.js";


interface ToastProviderProps {
    children: React.ReactNode | React.ReactNode[];
}
export function ToastProvider({ children }: ToastProviderProps) {
    const [data, setData] = useState<ToastProps | null>(null);

    const toast = (data: ToastProps | null) => {
        setData(data);
    }

    return (
        <>
            <ToastContext.Provider value={toast}>{children}</ToastContext.Provider>
            {data && <Portal>
                <NotificationPanel data={data} onClose={() => toast(null)} />
            </Portal>}
        </>
    )
}
