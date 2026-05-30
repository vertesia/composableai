import { createContext, useContext } from 'react';
import type { ToastProps } from './ToastProps.js';

export function useToast() {
    return useContext(ToastContext);
}

export type ToastFn = (data: ToastProps) => void;

const ToastContext = createContext<ToastFn>(() => {});

export { ToastContext };
