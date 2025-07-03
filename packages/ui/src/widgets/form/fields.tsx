interface FormLabelProps {
    htmlFor?: string;
    required?: boolean;
    children: React.ReactNode | React.ReactNode[];
}
export function FormLabel({ htmlFor, required, children }: FormLabelProps) {
    return (
        <label htmlFor={htmlFor} className="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200">
            {children}{required && <sup className="text-red-600">*</sup>}
        </label>
    )
}

interface FormHelperProps {
    children: React.ReactNode | React.ReactNode[];
}
export function FormHelper({ children }: FormHelperProps) {
    return (
        <p className="mt-2 text-sm text-gray-500">
            {children}
        </p>
    )
}

interface FormErrorProps {
    children: React.ReactNode | React.ReactNode[];
}
export function FormError({ children }: FormErrorProps) {
    return (
        <p className="mt-2 text-sm text-red-600">
            {children}
        </p>
    )
}
