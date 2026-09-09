import { FormItem } from '@vertesia/ui/core';

interface FormLabelProps {
    label?: string;
    required?: boolean;
    children: React.ReactNode | React.ReactNode[];
}
export function FormLabel({ label, required, children }: FormLabelProps) {
    return (
        <FormItem label={label} required={required}>
            {children}
        </FormItem>
    );
}

interface FormHelperProps {
    children: React.ReactNode | React.ReactNode[];
}
export function FormHelper({ children }: FormHelperProps) {
    return <p className="mt-2 text-sm text-muted">{children}</p>;
}

interface FormErrorProps {
    children: React.ReactNode | React.ReactNode[];
}
export function FormError({ children }: FormErrorProps) {
    return <p className="mt-2 text-sm text-destructive">{children}</p>;
}
