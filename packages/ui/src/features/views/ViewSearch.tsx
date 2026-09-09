import { Button, FormItem, Input } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { Search } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { ViewSearchRendererProps } from './types.js';

type ViewKeyTerm = NonNullable<ViewSearchRendererProps['configuration']['key_terms']>[number];

function keyTermInputType(type: string, multiple: boolean | undefined): 'text' | 'number' | 'date' {
    if (multiple) return 'text';
    if (type === 'number') return 'number';
    if (type === 'date') return 'date';
    return 'text';
}

function rangeBounds(values: string[]): [string, string] {
    const [from = '', to = ''] = (values[0] ?? '').split('..', 2);
    return [from, to];
}

function rangeValues(from: string, to: string): string[] {
    return from || to ? [`${from}..${to}`] : [];
}

function serializeKeyTerm(values: string[], multiple: boolean | undefined): string {
    return multiple ? values.join(', ') : (values[0] ?? '');
}

function parseKeyTerm(value: string, multiple: boolean | undefined): string[] {
    if (multiple) {
        return value
            .split(',')
            .map((entry) => entry.trim())
            .filter(Boolean);
    }
    return value.trim() ? [value.trim()] : [];
}

function KeyTermInput({
    term,
    values,
    isLoading,
    onChange,
}: {
    term: ViewKeyTerm;
    values: string[];
    isLoading: boolean;
    onChange: (values: string[]) => void;
}) {
    const focused = useRef(false);
    const lastEmittedValues = useRef<string | undefined>(undefined);
    const [input, setInput] = useState(() => serializeKeyTerm(values, term.multiple));
    const serializedValues = serializeKeyTerm(values, term.multiple);

    useEffect(() => {
        const isLocalEcho = focused.current && lastEmittedValues.current === serializedValues;
        if (!isLocalEcho) setInput(serializedValues);
        lastEmittedValues.current = undefined;
    }, [serializedValues]);

    return (
        <FormItem label={term.label}>
            <Input
                type={keyTermInputType(term.type, term.multiple)}
                name={`view-key-term-${term.id}`}
                autoComplete="off"
                value={input}
                onFocus={() => {
                    focused.current = true;
                }}
                onBlur={() => {
                    focused.current = false;
                    const normalized = parseKeyTerm(input, term.multiple);
                    setInput(serializeKeyTerm(normalized, term.multiple));
                }}
                onChange={(value) => {
                    setInput(value);
                    const parsed = parseKeyTerm(value, term.multiple);
                    lastEmittedValues.current = serializeKeyTerm(parsed, term.multiple);
                    onChange(parsed);
                }}
                placeholder={term.label}
                disabled={isLoading}
            />
        </FormItem>
    );
}

export function DefaultViewSearch({
    configuration,
    query,
    keyTerms,
    isLoading,
    onQueryChange,
    onKeyTermsChange,
    onSubmit,
}: ViewSearchRendererProps) {
    const { t } = useUITranslation();
    const searchId = useId();
    const fieldTerms = configuration.key_terms?.filter((term) => term.operator !== 'range') ?? [];
    const rangeTerms = configuration.key_terms?.filter((term) => term.operator === 'range') ?? [];

    const renderTerm = (term: ViewKeyTerm) => (
        <KeyTermInput
            key={term.id}
            term={term}
            values={keyTerms[term.id] ?? []}
            isLoading={isLoading}
            onChange={(values) => onKeyTermsChange(term.id, values)}
        />
    );

    const renderRange = (term: ViewKeyTerm) => {
        const [from, to] = rangeBounds(keyTerms[term.id] ?? []);
        const inputType = term.type === 'number' ? 'number' : term.type === 'date' ? 'date' : 'text';
        return (
            <fieldset key={term.id} className="min-w-0">
                <legend className="mb-1 text-sm font-medium">{term.label}</legend>
                <div className="grid grid-cols-2 gap-2">
                    <Input
                        type={inputType}
                        name={`view-key-term-${term.id}-from`}
                        autoComplete="off"
                        aria-label={`${term.label}: ${t('view.from')}`}
                        value={from}
                        onChange={(value) => onKeyTermsChange(term.id, rangeValues(value.trim(), to))}
                        placeholder={t('view.from')}
                        disabled={isLoading}
                    />
                    <Input
                        type={inputType}
                        name={`view-key-term-${term.id}-to`}
                        autoComplete="off"
                        aria-label={`${term.label}: ${t('view.to')}`}
                        value={to}
                        onChange={(value) => onKeyTermsChange(term.id, rangeValues(from, value.trim()))}
                        placeholder={t('view.to')}
                        disabled={isLoading}
                    />
                </div>
            </fieldset>
        );
    };

    return (
        <form
            className="flex flex-col gap-3"
            aria-label={t('layout.search')}
            autoComplete="off"
            onSubmit={(event) => {
                event.preventDefault();
                onSubmit();
            }}
        >
            <div className="flex items-center gap-2">
                <label htmlFor={searchId} className="sr-only">
                    {t('layout.search')}
                </label>
                <Input
                    id={searchId}
                    name="view-query"
                    autoComplete="off"
                    value={query}
                    onChange={onQueryChange}
                    placeholder={configuration.placeholder ?? t('store.searchPlaceholder')}
                    disabled={isLoading}
                />
                <Button type="submit" disabled={isLoading} className="shrink-0">
                    <Search className="size-4" />
                    {isLoading ? t('store.searching') : t('store.search')}
                </Button>
            </div>
            {configuration.key_terms && configuration.key_terms.length > 0 && (
                <div className="grid gap-3 lg:grid-cols-2">
                    {fieldTerms.length > 0 && (
                        <fieldset
                            className={`rounded-md border border-mixer-muted/30 bg-mixer-muted/5 p-3 ${
                                rangeTerms.length === 0 ? 'lg:col-span-2' : ''
                            }`}
                        >
                            <legend className="px-1 text-xs font-medium text-muted">{t('view.searchFields')}</legend>
                            <div
                                className={`grid gap-3 sm:grid-cols-2 ${
                                    rangeTerms.length === 0 ? 'lg:grid-cols-4' : ''
                                }`}
                            >
                                {fieldTerms.map(renderTerm)}
                            </div>
                        </fieldset>
                    )}
                    {rangeTerms.length > 0 && (
                        <fieldset
                            className={`rounded-md border border-mixer-muted/30 bg-mixer-muted/5 p-3 ${
                                fieldTerms.length === 0 ? 'lg:col-span-2' : ''
                            }`}
                        >
                            <legend className="px-1 text-xs font-medium text-muted">{t('view.ranges')}</legend>
                            <div className="grid gap-3 sm:grid-cols-2">{rangeTerms.map(renderRange)}</div>
                        </fieldset>
                    )}
                </div>
            )}
        </form>
    );
}
