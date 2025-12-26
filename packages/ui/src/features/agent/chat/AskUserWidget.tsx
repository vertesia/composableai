import React from "react";
import { Button } from "@vertesia/ui/core";
import { MessageSquare, CheckCircle, XCircle, AlertCircle, HelpCircle } from "lucide-react";

/** Option for user to select */
export interface AskUserOption {
    id: string;
    label: string;
    description?: string;
    icon?: React.ReactNode;
}

/** Props for the AskUserWidget component */
export interface AskUserWidgetProps {
    /** The question or prompt to display */
    question: string;
    /** Optional description or additional context */
    description?: string;
    /** Options for the user to choose from */
    options?: AskUserOption[];
    /** Called when user selects an option */
    onSelect?: (optionId: string) => void;
    /** Called when user submits a free-form response */
    onSubmit?: (response: string) => void;
    /** Whether to show a text input for free-form response */
    allowFreeResponse?: boolean;
    /** Placeholder for free-form input */
    placeholder?: string;
    /** Whether the widget is in a loading/processing state */
    isLoading?: boolean;
    /** Custom icon to display */
    icon?: React.ReactNode;
    /** Variant for styling */
    variant?: "default" | "warning" | "info" | "success";
    /** Hide the default icon */
    hideIcon?: boolean;
    /** Hide the border */
    hideBorder?: boolean;

    // Styling props for full customization
    /** Additional className for the outer container */
    className?: string;
    /** Additional className for the card wrapper */
    cardClassName?: string;
    /** Additional className for the header section */
    headerClassName?: string;
    /** Additional className for the icon wrapper */
    iconClassName?: string;
    /** Additional className for the question text */
    questionClassName?: string;
    /** Additional className for the description text */
    descriptionClassName?: string;
    /** Additional className for the options container */
    optionsClassName?: string;
    /** Additional className for option buttons */
    buttonClassName?: string;
    /** Additional className for the input container */
    inputContainerClassName?: string;
    /** Additional className for the text input */
    inputClassName?: string;
    /** Additional className for the submit button */
    submitButtonClassName?: string;
}

const VARIANT_STYLES = {
    default: {
        border: "border-l-attention",
        bg: "bg-amber-50 dark:bg-amber-900/20",
        icon: "text-attention",
    },
    warning: {
        border: "border-l-destructive",
        bg: "bg-red-50 dark:bg-red-900/20",
        icon: "text-destructive",
    },
    info: {
        border: "border-l-info",
        bg: "bg-blue-50 dark:bg-blue-900/20",
        icon: "text-info",
    },
    success: {
        border: "border-l-success",
        bg: "bg-green-50 dark:bg-green-900/20",
        icon: "text-success",
    },
};

const VARIANT_ICONS = {
    default: HelpCircle,
    warning: AlertCircle,
    info: MessageSquare,
    success: CheckCircle,
};

/**
 * AskUserWidget - A styled component for displaying agent prompts/questions to users
 *
 * Use this when the agent needs user input, confirmation, or selection from options.
 * Supports both option selection and free-form text input.
 */
export function AskUserWidget({
    question,
    description,
    options,
    onSelect,
    onSubmit,
    allowFreeResponse = false,
    placeholder = "Type your response...",
    isLoading = false,
    icon,
    variant = "default",
    hideIcon = false,
    hideBorder = false,
    // Styling props
    className,
    cardClassName,
    headerClassName,
    iconClassName,
    questionClassName,
    descriptionClassName,
    optionsClassName,
    buttonClassName,
    inputContainerClassName,
    inputClassName,
    submitButtonClassName,
}: AskUserWidgetProps) {
    const [inputValue, setInputValue] = React.useState("");
    const inputRef = React.useRef<HTMLInputElement>(null);

    const styles = VARIANT_STYLES[variant];
    const DefaultIcon = VARIANT_ICONS[variant];

    const handleSubmit = () => {
        if (inputValue.trim() && onSubmit) {
            onSubmit(inputValue.trim());
            setInputValue("");
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const borderClass = hideBorder ? "" : `border-l-4 ${styles.border}`;

    return (
        <div className={`my-4 ${className || ""}`}>
            <div
                className={`${borderClass} ${styles.bg} rounded-r-lg shadow-sm ${cardClassName || ""}`}
            >
                {/* Header with icon and question */}
                <div className={`px-4 py-3 ${headerClassName || ""}`}>
                    <div className="flex items-start gap-3">
                        {!hideIcon && (
                            <div className={`flex-shrink-0 mt-0.5 ${styles.icon} ${iconClassName || ""}`}>
                                {icon || <DefaultIcon className="size-5" />}
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <h4 className={`text-sm font-semibold text-gray-900 dark:text-gray-100 ${questionClassName || ""}`}>
                                {question}
                            </h4>
                            {description && (
                                <p className={`mt-1 text-sm text-gray-600 dark:text-gray-400 ${descriptionClassName || ""}`}>
                                    {description}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Options */}
                {options && options.length > 0 && (
                    <div className={`px-4 pb-3 pt-1 ${optionsClassName || ""}`}>
                        <div className="flex flex-wrap gap-2">
                            {options.map((option) => (
                                <Button
                                    key={option.id}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onSelect?.(option.id)}
                                    disabled={isLoading}
                                    className={`flex items-center gap-2 ${buttonClassName || ""}`}
                                    title={option.description}
                                >
                                    {option.icon}
                                    {option.label}
                                </Button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Free-form input */}
                {allowFreeResponse && (
                    <div className={`px-4 pb-3 pt-1 ${inputContainerClassName || ""}`}>
                        <div className="flex gap-2">
                            <input
                                ref={inputRef}
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={placeholder}
                                disabled={isLoading}
                                className={`flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${inputClassName || ""}`}
                            />
                            <Button
                                size="sm"
                                onClick={handleSubmit}
                                disabled={isLoading || !inputValue.trim()}
                                className={submitButtonClassName}
                            >
                                {isLoading ? "..." : "Send"}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * Simple confirmation widget - Yes/No options
 */
export interface ConfirmationWidgetProps {
    question: string;
    description?: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
    isLoading?: boolean;
    variant?: "default" | "warning";
    className?: string;
}

export function ConfirmationWidget({
    question,
    description,
    onConfirm,
    onCancel,
    confirmLabel = "Yes",
    cancelLabel = "No",
    isLoading = false,
    variant = "default",
    className,
}: ConfirmationWidgetProps) {
    return (
        <AskUserWidget
            question={question}
            description={description}
            variant={variant}
            isLoading={isLoading}
            className={className}
            options={[
                {
                    id: "confirm",
                    label: confirmLabel,
                    icon: <CheckCircle className="size-4" />,
                },
                {
                    id: "cancel",
                    label: cancelLabel,
                    icon: <XCircle className="size-4" />,
                },
            ]}
            onSelect={(id) => {
                if (id === "confirm") onConfirm();
                else onCancel();
            }}
        />
    );
}
