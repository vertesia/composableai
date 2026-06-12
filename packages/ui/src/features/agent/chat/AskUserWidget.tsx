import { Button, cn } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { AlertCircle, CheckCircle, HelpCircle, MessageSquare, Send, XCircle } from 'lucide-react';
import React from 'react';
import { MarkdownRenderer } from '../../../widgets/markdown/MarkdownRenderer';

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
    variant?: 'default' | 'warning' | 'info' | 'success';
    /** Hide the default icon */
    hideIcon?: boolean;
    /** Hide the border */
    hideBorder?: boolean;
    /** Use the compact chat transcript layout */
    compact?: boolean;
    /** Render as a resolved transcript prompt, without pending controls */
    answered?: boolean;

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
        border: 'border-s-attention',
        bg: 'bg-amber-50 dark:bg-amber-900/20',
        icon: 'text-attention',
    },
    warning: {
        border: 'border-s-destructive',
        bg: 'bg-red-50 dark:bg-red-900/20',
        icon: 'text-destructive',
    },
    info: {
        border: 'border-s-info',
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        icon: 'text-info',
    },
    success: {
        border: 'border-s-success',
        bg: 'bg-green-50 dark:bg-green-900/20',
        icon: 'text-success',
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
    placeholder,
    isLoading = false,
    icon,
    variant = 'default',
    hideIcon = false,
    hideBorder = false,
    compact = false,
    answered = false,
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
    const { t } = useUITranslation();
    const resolvedPlaceholder = placeholder ?? t('agent.typeYourResponse');
    const [inputValue, setInputValue] = React.useState('');
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
            setInputValue('');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const borderClass = hideBorder ? '' : `border-s-4 ${styles.border}`;

    if (compact) {
        const iconNode = icon || <DefaultIcon className="size-4" />;
        const compactQuestion = (
            <div className={cn('agent-ask-question text-sm leading-6 text-foreground/85', questionClassName)}>
                <MarkdownRenderer>{question}</MarkdownRenderer>
            </div>
        );

        if (answered) {
            return (
                <div className={cn('my-1.5 font-sans', className)}>
                    {compactQuestion}
                    {description && (
                        <p className={cn('mt-1 text-xs leading-5 text-muted', descriptionClassName)}>{description}</p>
                    )}
                </div>
            );
        }

        return (
            <div className={cn('my-2 font-sans', className)}>
                <div className={cn('rounded-lg border border-border bg-background/60 shadow-none', cardClassName)}>
                    <div className={cn('px-3 py-2', headerClassName)}>
                        <div className="flex items-start gap-2.5">
                            {!hideIcon && (
                                <div className={cn('mt-1 flex-shrink-0 text-attention', iconClassName)}>{iconNode}</div>
                            )}
                            <div className="min-w-0 flex-1">
                                {compactQuestion}
                                {description && (
                                    <p className={cn('mt-1 text-xs leading-5 text-muted', descriptionClassName)}>
                                        {description}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {options && options.length > 0 && (
                        <div className={cn('flex flex-col gap-1.5 px-3 pb-3 pt-0', optionsClassName)}>
                            {multiSelect ? (
                                <>
                                    {options.map((option) => {
                                        const selected = selectedOptions.has(option.id);
                                        return (
                                            <label
                                                key={option.id}
                                                className={cn(
                                                    'flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2 text-start transition-colors',
                                                    selected
                                                        ? 'border-info/60 bg-info/10'
                                                        : 'border-border bg-background/70 hover:bg-mixer-muted/15',
                                                    isLoading && 'cursor-not-allowed opacity-50',
                                                    buttonClassName,
                                                )}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selected}
                                                    onChange={() => toggleOption(option.id)}
                                                    disabled={isLoading}
                                                    className="mt-1 size-4 rounded border-border bg-background text-info focus:ring-info"
                                                />
                                                <span className="min-w-0 flex-1">
                                                    <span className="flex items-center gap-2 text-sm font-medium leading-5 text-foreground">
                                                        {option.icon}
                                                        <span className="break-words">{option.label}</span>
                                                    </span>
                                                    {option.description && (
                                                        <span className="mt-0.5 block break-words text-xs leading-5 text-muted">
                                                            {option.description}
                                                        </span>
                                                    )}
                                                </span>
                                            </label>
                                        );
                                    })}
                                    <div className="pt-1">
                                        <Button
                                            size="sm"
                                            onClick={handleMultiSubmit}
                                            disabled={isLoading || selectedOptions.size === 0}
                                            className="inline-flex items-center gap-2"
                                        >
                                            <Send className="size-4" />
                                            {selectedOptions.size > 0
                                                ? t('agent.submitSelectionCount', { count: selectedOptions.size })
                                                : t('agent.submitSelection')}
                                        </Button>
                                    </div>
                                </>
                            ) : (
                                options.map((option) => (
                                    <button
                                        type="button"
                                        key={option.id}
                                        onClick={() => onSelect?.(option.id)}
                                        disabled={isLoading}
                                        className={cn(
                                            'flex w-full cursor-pointer items-start gap-2.5 rounded-md border border-border bg-background/70 px-3 py-2 text-start transition-colors',
                                            'hover:bg-mixer-muted/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                            isLoading && 'cursor-not-allowed opacity-50',
                                            buttonClassName,
                                        )}
                                    >
                                        <span
                                            className="mt-1 size-4 flex-shrink-0 rounded-full border border-border"
                                            aria-hidden="true"
                                        />
                                        <span className="min-w-0 flex-1">
                                            <span className="flex items-center gap-2 text-sm font-medium leading-5 text-foreground">
                                                {option.icon}
                                                <span className="break-words">{option.label}</span>
                                            </span>
                                            {option.description && (
                                                <span className="mt-0.5 block break-words text-xs leading-5 text-muted">
                                                    {option.description}
                                                </span>
                                            )}
                                        </span>
                                    </button>
                                ))
                            )}
                        </div>
                    )}

                    {allowFreeResponse && (
                        <div className={cn('px-3 pb-3 pt-0', inputContainerClassName)}>
                            <div className="flex gap-2">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder={resolvedPlaceholder}
                                    disabled={isLoading}
                                    className={cn(
                                        'min-w-0 flex-1 rounded-md border border-border bg-background/70 px-3 py-2 text-sm text-foreground focus:border-transparent focus:ring-2 focus:ring-ring',
                                        inputClassName,
                                    )}
                                />
                                <Button
                                    size="sm"
                                    onClick={handleSubmit}
                                    disabled={isLoading || !inputValue.trim()}
                                    className={submitButtonClassName}
                                >
                                    {isLoading ? '...' : t('agent.send')}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className={`my-4 font-sans ${className || ''}`}>
            <div className={`${borderClass} ${styles.bg} rounded-e-lg shadow-sm ${cardClassName || ''}`}>
                {/* Header with icon and question */}
                <div className={`px-4 py-3 ${headerClassName || ''}`}>
                    <div className="flex items-start gap-3">
                        {!hideIcon && (
                            <div className={`flex-shrink-0 mt-0.5 ${styles.icon} ${iconClassName || ''}`}>
                                {icon || <DefaultIcon className="size-5" />}
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <div
                                className={`prose prose-sm dark:prose-invert max-w-none text-gray-900 dark:text-gray-100 ${questionClassName || ''}`}
                            >
                                <MarkdownRenderer>{question}</MarkdownRenderer>
                            </div>
                            {description && (
                                <p
                                    className={`mt-1 text-sm text-gray-600 dark:text-gray-400 ${descriptionClassName || ''}`}
                                >
                                    {description}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Options */}
                {options && options.length > 0 && (
                    <div className={`px-4 pb-3 pt-1 ${optionsClassName || ''}`}>
                        {multiSelect ? (
                            /* Multi-select mode with checkboxes */
                            <div className="space-y-2">
                                {options.map((option) => (
                                    <label
                                        key={option.id}
                                        className={`flex items-start gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors
                                            ${
                                                selectedOptions.has(option.id)
                                                    ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700'
                                                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                                            }
                                            ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                                        {selectedOptions.size > 0
                                            ? t('agent.submitSelectionCount', { count: selectedOptions.size })
                                            : t('agent.submitSelection')}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            /* Single-select mode - always use full-width card layout for clarity */
                            <div className="flex flex-col gap-2 w-full">
                                {options.map((option) => (
                                    <Button
                                        variant="unstyled"
                                        key={option.id}
                                        onClick={() => onSelect?.(option.id)}
                                        disabled={isLoading}
                                        className={`w-full h-auto whitespace-normal text-start px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700
                                            bg-white dark:bg-gray-800
                                            hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600
                                            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
                                            transition-colors
                                            ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                                            ${buttonClassName || ''}`}
                                    >
                                        <div className="flex items-start gap-3">
                                            {option.icon && (
                                                <span className="flex-shrink-0 mt-0.5 text-gray-500 dark:text-gray-400">
                                                    {option.icon}
                                                </span>
                                            )}
                                            <div className="flex-1 overflow-hidden">
                                                <div className="font-medium text-sm text-gray-900 dark:text-gray-100 break-words text-center">
                                                    {option.label}
                                                </div>
                                                {option.description && (
                                                    <div className="mt-1 text-sm text-gray-500 dark:text-gray-400 break-words whitespace-pre-wrap">
                                                        {option.description}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </Button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Free-form input */}
                {allowFreeResponse && (
                    <div className={`px-4 pb-3 pt-1 ${inputContainerClassName || ''}`}>
                        <div className="flex gap-2">
                            <input
                                ref={inputRef}
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={resolvedPlaceholder}
                                disabled={isLoading}
                                className={`flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${inputClassName || ''}`}
                            />
                            <Button
                                size="sm"
                                onClick={handleSubmit}
                                disabled={isLoading || !inputValue.trim()}
                                className={submitButtonClassName}
                            >
                                {isLoading ? '...' : t('agent.send')}
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
    variant?: 'default' | 'warning';
    className?: string;
}

export function ConfirmationWidget({
    question,
    description,
    onConfirm,
    onCancel,
    confirmLabel,
    cancelLabel,
    isLoading = false,
    variant = 'default',
    className,
}: ConfirmationWidgetProps) {
    const { t } = useUITranslation();
    const resolvedConfirmLabel = confirmLabel ?? t('agent.yes');
    const resolvedCancelLabel = cancelLabel ?? t('agent.no');
    return (
        <AskUserWidget
            question={question}
            description={description}
            variant={variant}
            isLoading={isLoading}
            className={className}
            options={[
                {
                    id: 'confirm',
                    label: resolvedConfirmLabel,
                    icon: <CheckCircle className="size-4" />,
                },
                {
                    id: 'cancel',
                    label: resolvedCancelLabel,
                    icon: <XCircle className="size-4" />,
                },
            ]}
            onSelect={(id) => {
                if (id === 'confirm') onConfirm();
                else onCancel();
            }}
        />
    );
}
