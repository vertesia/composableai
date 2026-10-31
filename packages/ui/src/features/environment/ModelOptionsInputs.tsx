import { type JSONObject, type ModelOptionInfoItem, type ModelOptions, OptionType } from '@llumiverse/common';
import { Button, FormItem, InputList, NumberInput, SelectBox, Switch } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { JSONEditor } from '@vertesia/ui/widgets';
import type { TFunction } from 'i18next';
import { useState } from 'react';

interface OptionInputProps {
    options: ModelOptionInfoItem[];
    onChangeField: (name: string, value: unknown) => void;
    modelConfig?: ModelOptions;
    isClearable?: boolean;
    disabledOptions?: string[];
    disabled?: boolean;
}
export function ModelOptionsInputs({
    options,
    onChangeField,
    modelConfig,
    isClearable,
    disabledOptions,
    disabled = false,
}: OptionInputProps) {
    return options.map((option) => (
        <OptionInputItem
            key={option.name}
            option={option}
            onChangeField={onChangeField}
            modelConfig={modelConfig}
            isClearable={isClearable}
            disabled={disabled || disabledOptions?.includes(option.name)}
        />
    ));
}

interface OptionInputItemProps {
    option: ModelOptionInfoItem;
    onChangeField: (name: string, value: unknown) => void;
    modelConfig?: ModelOptions;
    isClearable?: boolean;
    disabled?: boolean;
}
function OptionInputItem({ option, onChangeField, modelConfig, isClearable, disabled }: OptionInputItemProps) {
    const { t } = useUITranslation();
    const optionValue = modelConfig ? Reflect.get(modelConfig, option.name) : undefined;
    const [jsonObjectError, setJsonObjectError] = useState<string>();
    const [numericListError, setNumericListError] = useState<string>();
    const label = SentenceCaseName(option.name);
    const canReset =
        isClearable &&
        !disabled &&
        optionValue !== undefined &&
        option.type !== OptionType.numeric &&
        option.type !== OptionType.enum;
    let input_form = <p>{t('modelOptions.unsupported')}</p>;
    if (option.type === OptionType.numeric) {
        input_form = (
            <NumberInput
                name={option.name}
                value={typeof optionValue === 'number' ? optionValue : undefined}
                onChange={(value) => onChangeField(option.name, value)}
                min={option.min}
                max={option.max}
                step={option.step ?? (option.integer ? 1 : 0.1)}
                noScroll
                placeholder={t('modelOptions.modelDefault')}
                disabled={disabled}
            />
        );
    } else if (option.type === OptionType.enum) {
        input_form = (
            <SelectBox
                options={Object.values(option.enum)}
                value={typeof optionValue === 'string' ? optionValue : undefined}
                onChange={(value) => onChangeField(option.name, value)}
                placeholder={t('agent.selectOption')}
                isClearable={isClearable}
                disabled={disabled}
            />
        );
    } else if (option.type === OptionType.string_list) {
        const values =
            Array.isArray(optionValue) && optionValue.every((value): value is string => typeof value === 'string')
                ? optionValue
                : undefined;
        input_form = (
            <InputList value={values} onChange={(value) => onChangeField(option.name, value)} disabled={disabled} />
        );
    } else if (option.type === OptionType.boolean) {
        input_form = (
            <Switch
                value={typeof optionValue === 'boolean' ? optionValue : option.default === true}
                onChange={(value) => onChangeField(option.name, value)}
                disabled={disabled}
            />
        );
    } else if (option.type === OptionType.numeric_list) {
        const values =
            Array.isArray(optionValue) && optionValue.every((value) => typeof value === 'number')
                ? optionValue.map(String)
                : undefined;
        input_form = (
            <InputList
                value={values}
                disabled={disabled}
                onChange={(value) => {
                    const numbers = value.map(Number);
                    if (value.some((item) => !item.trim()) || numbers.some((item) => !Number.isFinite(item))) {
                        setNumericListError(t('modelOptions.numericListError'));
                        return;
                    }
                    setNumericListError(undefined);
                    onChangeField(option.name, numbers);
                }}
            />
        );
    } else if (option.type === OptionType.json_object) {
        input_form = (
            <div>
                <JSONEditor
                    value={isJSONObject(optionValue) ? optionValue : undefined}
                    readonly={disabled}
                    height="180px"
                    onValidChange={(value) => {
                        if (!isJSONObject(value)) {
                            setJsonObjectError(t('modelOptions.jsonObjectError'));
                            return;
                        }
                        setJsonObjectError(undefined);
                        onChangeField(option.name, value);
                    }}
                />
                {jsonObjectError && <p className="mt-1 text-xs text-destructive">{jsonObjectError}</p>}
            </div>
        );
    }

    return (
        <div className={`relative ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <FormItem label={label} description={DescriptionWithLimits(option, t)} error={numericListError}>
                {input_form}
            </FormItem>
            {canReset && (
                <Button
                    variant="ghost"
                    size="xs"
                    aria-label={t('modelOptions.resetLabel', { label })}
                    onClick={() => {
                        setNumericListError(undefined);
                        setJsonObjectError(undefined);
                        onChangeField(option.name, undefined);
                    }}
                    className="absolute inset-e-0 top-0 h-5! py-0! text-[10px]!"
                >
                    {t('modelOptions.reset')}
                </Button>
            )}
        </div>
    );
}

function isJSONObject(value: unknown): value is JSONObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function SentenceCaseName(name: string) {
    return name
        .replace(/([A-Z])/g, ' $1') // Split on capital letters
        .replace(/[-_]/g, ' ') // Replace hyphens and underscores with spaces
        .toLowerCase() // Convert to lowercase
        .trim() // Remove leading/trailing spaces
        .split(' ') // Split into words
        .filter((word) => word) // Remove empty strings
        .map((word, index) => (index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word)) // Capitalize the first word
        .join(' ');
}

function DescriptionWithLimits(option: ModelOptionInfoItem, t: TFunction): string {
    const limits: string[] = [];
    // Construct min,max, and default string
    if (option.type === OptionType.numeric) {
        // Explicit undefined check because of falsy values (0, false, etc.)
        if (option.min !== undefined) {
            limits.push(t('modelOptions.min', { value: option.min }));
        }
        if (option.max !== undefined) {
            limits.push(t('modelOptions.max', { value: option.max }));
        }
        if (option.default !== undefined) {
            limits.push(t('modelOptions.default', { value: option.default }));
        }
    }

    const limitsString = limits.join(', ');

    if (option.description) {
        return `${option.description} ${limitsString ? `(${limitsString})` : ''}`;
    } else {
        return limitsString;
    }
}
