import React from "react";
import { Button } from "@vertesia/ui/core";
import { MarkdownRenderer } from "@vertesia/ui/widgets";
import { MessageSquare, CheckCircle, XCircle, AlertCircle, HelpCircle, Send } from "lucide-react";

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
    /** Called when user selects an option (single select mode) */
    onSelect?: (optionId: string) => void;
    /** Called when user submits selected options (multi select mode) */
    onMultiSelect?: (optionIds: string[]) => void;
    /** Called when user submits a free-form response */
    onSubmit?: (response: string) => void;
    /** Whether to show a text input for free-form response */
    allowFreeResponse?: boolean;
    /** Whether to allow multiple selections with checkboxes */
    multiSelect?: boolean;
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
    onMultiSelect,
    onSubmit,
    allowFreeResponse = false,
    multiSelect = false,
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
    const [selectedOptions, setSelectedOptions] = React.useState<Set<string>>(new Set());
    const inputRef = React.useRef<HTMLInputElement>(null);

    const styles = VARIANT_STYLES[variant];
    const DefaultIcon = VARIANT_ICONS[variant];

    const toggleOption = (optionId: string) => {
        setSelectedOptions((prev) => {
            const next = new Set(prev);
            if (next.has(optionId)) {
                next.delete(optionId);
            } else {
                next.add(optionId);
            }
            return next;
        });
    };

    const handleMultiSubmit = () => {
        if (selectedOptions.size > 0 && onMultiSelect) {
            onMultiSelect(Array.from(selectedOptions));
            setSelectedOptions(new Set());
        }
    };

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
        <div className={`my-4 font-sans ${className || ""}`}>
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
                            <div className={`prose prose-sm dark:prose-invert max-w-none text-gray-900 dark:text-gray-100 ${questionClassName || ""}`}>
                                <MarkdownRenderer>{question}</MarkdownRenderer>
                            </div>
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
                        {multiSelect ? (
                            /* Multi-select mode with checkboxes */
                            <div className="space-y-2">
                                {options.map((option) => (
                                    <label
                                        key={option.id}
                                        className={`flex items-start gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors
                                            ${selectedOptions.has(option.id)
                                                ? "bg-blue-50 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700"
                                                : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                                            }
                                            ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedOptions.has(option.id)}
                                            onChange={() => toggleOption(option.id)}
                                            disabled={isLoading}
                                            className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                                        />
                                        <div className="flex-1 overflow-hidden">
                                            <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100 break-words">
                                                {option.icon}
                                                <span className="break-words">{option.label}</span>
                                            </div>
                                            {option.description && (
                                                <div className="mt-1 text-sm text-gray-500 dark:text-gray-400 break-words whitespace-pre-wrap">
                                                    {option.description}
                                                </div>
                                            )}
                                        </div>
                                    </label>
                                ))}
                                <div className="pt-2">
                                    <Button
                                        size="sm"
                                        onClick={handleMultiSubmit}
                                        disabled={isLoading || selectedOptions.size === 0}
                                        className="flex items-center gap-2"
                                    >
                                        <Send className="size-4" />
                                        Submit Selection{selectedOptions.size > 0 ? ` (${selectedOptions.size})` : ""}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            /* Single-select mode - always use full-width card layout for clarity */
                            <div className="flex flex-col gap-2 w-full">
                                {options.map((option) => (
                                    <button
                                        key={option.id}
                                        onClick={() => onSelect?.(option.id)}
                                        disabled={isLoading}
                                        className={`w-full text-left px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700
                                            bg-white dark:bg-gray-800
                                            hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600
                                            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
                                            transition-colors
                                            ${isLoading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                                            ${buttonClassName || ""}`}
                                    >
                                        <div className="flex items-start gap-3">
                                            {option.icon && (
                                                <span className="flex-shrink-0 mt-0.5 text-gray-500 dark:text-gray-400">
                                                    {option.icon}
                                                </span>
                                            )}
                                            <div className="flex-1 overflow-hidden">
                                                <div className="font-medium text-sm text-gray-900 dark:text-gray-100 break-words">
                                                    {option.label}
                                                </div>
                                                {option.description && (
                                                    <div className="mt-1 text-sm text-gray-500 dark:text-gray-400 break-words whitespace-pre-wrap">
                                                        {option.description}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
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
