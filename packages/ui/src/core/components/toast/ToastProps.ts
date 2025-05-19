export interface ToastProps {
    status: 'success' | 'error' | 'warning' | 'info';
    title: string;
    description?: string;
    duration?: number
}
