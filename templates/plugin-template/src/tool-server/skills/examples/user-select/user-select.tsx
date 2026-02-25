import React from 'react';

const { useState } = React;

/**
 * Option structure for user selection
 */
interface SelectOption {
    text: string;
    value: string;
}

/**
 * User selection data structure
 */
interface UserSelectData {
    options: SelectOption[];
    multiple?: boolean;
}

/**
 * Props for the UserSelectWidget component
 */
interface UserSelectWidgetProps {
    /**
     * The selection data as a JSON string or parsed object
     */
    code: string | UserSelectData;
}

/**
 * Interactive user selection widget component
 *
 * This widget renders selection options for users to choose from.
 * It supports both single and multiple selection modes.
 */
export default function UserSelectWidget(props: UserSelectWidgetProps) {
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [submitted, setSubmitted] = useState(false);

    // Parse the data - handle both string and object inputs
    let data: UserSelectData;
    try {
        if (typeof props.code === 'string') {
            data = JSON.parse(props.code);
        } else {
            data = props.code;
        }
    } catch (_error) {
        return (
            <div className="border border-destructive bg-destructive/10 rounded-lg p-4">
                <p className="text-destructive font-medium">Error: Invalid selection data</p>
                <p className="text-sm text-muted mt-2">Failed to parse selection JSON</p>
            </div>
        );
    }

    // Validate data structure
    if (!data.options || !Array.isArray(data.options) || data.options.length === 0) {
        return (
            <div className="border border-destructive bg-destructive/10 rounded-lg p-4">
                <p className="text-destructive font-medium">Error: Invalid selection structure</p>
                <p className="text-sm text-muted mt-2">
                    Selection must have at least one option
                </p>
            </div>
        );
    }

    // Validate each option has text and value
    const invalidOption = data.options.find(opt => !opt.text || !opt.value);
    if (invalidOption) {
        return (
            <div className="border border-destructive bg-destructive/10 rounded-lg p-4">
                <p className="text-destructive font-medium">Error: Invalid option format</p>
                <p className="text-sm text-muted mt-2">
                    Each option must have 'text' and 'value' fields
                </p>
            </div>
        );
    }

    const isMultiple = data.multiple === true;

    const handleOptionClick = (value: string) => {
        if (submitted) return;

        const newSelected = new Set(selected);

        if (isMultiple) {
            // Multi-select: toggle the option
            if (newSelected.has(value)) {
                newSelected.delete(value);
            } else {
                newSelected.add(value);
            }
        } else {
            // Single select: replace the selection
            newSelected.clear();
            newSelected.add(value);
        }

        setSelected(newSelected);
    };

    const handleSubmit = () => {
        if (selected.size === 0) return;
        setSubmitted(true);

        // Format the selected values for display
        const selectedOptions = data.options.filter(opt => selected.has(opt.value));
        console.log('User selected:', isMultiple ? Array.from(selected) : Array.from(selected)[0]);
        console.log('Selected options:', selectedOptions);
    };

    const handleReset = () => {
        setSelected(new Set());
        setSubmitted(false);
    };

    return (
        <div className="border border-mixer-5 bg-mixer-1 rounded-lg p-6 max-w-2xl">
            {/* Header */}
            <div className="mb-4">
                <h3 className="text-lg font-semibold mb-2">
                    {isMultiple ? 'Select Options' : 'Select an Option'}
                </h3>
                {isMultiple && !submitted && (
                    <p className="text-sm text-info">
                        ℹ️ You can select multiple options
                    </p>
                )}
            </div>

            {/* Options */}
            <div className="space-y-2 mb-4">
                {data.options.map((option, _index) => {
                    const isSelected = selected.has(option.value);

                    return (
                        <div
                            key={option.value}
                            onClick={() => handleOptionClick(option.value)}
                            className={`
                                relative border rounded-lg p-3 transition-all
                                ${submitted
                                    ? 'cursor-default'
                                    : 'cursor-pointer hover:border-mixer-10 hover:bg-mixer-2'
                                }
                                ${isSelected && !submitted
                                    ? 'border-info bg-info/10'
                                    : 'border-mixer-5'
                                }
                                ${submitted && isSelected
                                    ? 'border-success bg-success/10'
                                    : ''
                                }
                            `}
                        >
                            <div className="flex items-center gap-3">
                                {/* Selection indicator */}
                                {!submitted && (
                                    <div className={`
                                        w-5 h-5 border-2 flex items-center justify-center
                                        ${isMultiple ? 'rounded' : 'rounded-full'}
                                        ${isSelected
                                            ? 'border-info bg-info'
                                            : 'border-mixer-10'
                                        }
                                    `}>
                                        {isSelected && (
                                            <span className="text-white text-xs">✓</span>
                                        )}
                                    </div>
                                )}
                                {submitted && isSelected && (
                                    <div className="w-5 h-5 flex items-center justify-center">
                                        <span className="text-success text-lg">✓</span>
                                    </div>
                                )}
                                <span className={`font-medium ${submitted && isSelected ? 'text-success' : ''}`}>
                                    {option.text}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
                {!submitted ? (
                    <>
                        <button
                            onClick={handleSubmit}
                            disabled={selected.size === 0}
                            className={`
                                px-4 py-2 rounded-lg font-medium transition-all
                                ${selected.size > 0
                                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                                    : 'bg-mixer-3 text-muted cursor-not-allowed'
                                }
                            `}
                        >
                            Confirm Selection
                        </button>
                        {selected.size > 0 && (
                            <button
                                onClick={() => setSelected(new Set())}
                                className="px-4 py-2 rounded-lg font-medium border border-mixer-5 hover:bg-mixer-2 transition-all"
                            >
                                Clear
                            </button>
                        )}
                    </>
                ) : (
                    <>
                        <div className="flex-1 flex items-center text-success">
                            <span className="font-medium">✓ Selection confirmed</span>
                        </div>
                        <button
                            onClick={handleReset}
                            className="px-4 py-2 rounded-lg font-medium border border-mixer-5 hover:bg-mixer-2 transition-all"
                        >
                            Change Selection
                        </button>
                    </>
                )}
            </div>

            {/* Selected values display */}
            {submitted && (
                <div className="mt-4 p-3 bg-mixer-2 rounded-lg">
                    <p className="text-sm font-medium text-muted mb-1">Selected value{isMultiple && selected.size > 1 ? 's' : ''}:</p>
                    <code className="text-sm">
                        {isMultiple
                            ? JSON.stringify(Array.from(selected))
                            : Array.from(selected)[0]
                        }
                    </code>
                </div>
            )}
        </div>
    );
}
