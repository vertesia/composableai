// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ContentTypeIntakePolicy } from '@vertesia/common';
import { I18nProvider } from '@vertesia/ui/i18n';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IntakePolicyForm, type IntakePolicyFormSection } from './IntakePolicyForm.js';

vi.mock('@vertesia/ui/core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@vertesia/ui/core')>();
    return {
        ...actual,
        SelectBox: ({
            options,
            value,
            onChange,
            optionLabel,
            disabled,
            ...props
        }: {
            options: (string | { value: string; label: string })[];
            value?: string | { value: string };
            onChange: (value: unknown) => void;
            optionLabel?: (value: unknown) => string;
            disabled?: boolean;
            id?: string;
            'aria-label'?: string;
        }) => {
            const key = (item: string | { value: string } | undefined) =>
                typeof item === 'string' ? item : (item?.value ?? '');
            return (
                <select
                    id={props.id}
                    aria-label={props['aria-label']}
                    value={key(value)}
                    disabled={disabled}
                    onChange={(event) => onChange(options.find((item) => key(item) === event.target.value))}
                >
                    {options.map((item) => (
                        <option key={key(item)} value={key(item)}>
                            {optionLabel?.(item) ?? key(item)}
                        </option>
                    ))}
                </select>
            );
        },
    };
});
vi.mock('../../environment/SelectEnvironment.js', () => ({
    SelectEnvironment: ({ disabled }: { disabled?: boolean }) => <input aria-label="Environment" disabled={disabled} />,
    SelectModel: ({ disabled }: { disabled?: boolean }) => <input aria-label="Model" disabled={disabled} />,
}));

afterEach(cleanup);
const profile = {
    id: 'a'.repeat(24),
    name: 'Economy media',
    project: 'project-id',
    environment: 'b'.repeat(24),
    model: 'model',
    created_at: '2026-10-31',
    updated_at: '2026-10-31',
};
function Form({
    section = 'media',
    initial = {},
    readonly = false,
    error = false,
}: {
    section?: IntakePolicyFormSection;
    initial?: ContentTypeIntakePolicy;
    readonly?: boolean;
    error?: boolean;
}) {
    const [policy, setPolicy] = useState(initial);
    return (
        <I18nProvider lng="en">
            <IntakePolicyForm
                section={section}
                policy={policy}
                onChange={setPolicy}
                readonly={readonly}
                profileOptions={{ items: [profile], error }}
            />
            <output data-testid="policy">{JSON.stringify(policy)}</output>
        </I18nProvider>
    );
}

describe('intake policy profile forms', () => {
    it('writes each media profile and keeps the selected interaction', async () => {
        const user = userEvent.setup();
        render(<Form initial={{ media_analysis: { image: { interaction: 'Extractor@stable' } } }} />);
        for (const label of ['Image analysis', 'Audio analysis', 'Video analysis']) {
            await user.selectOptions(screen.getByRole('combobox', { name: `${label}: Inference profile` }), profile.id);
        }
        expect(JSON.parse(screen.getByTestId('policy').textContent ?? '{}')).toEqual({
            media_analysis: {
                image: { interaction: 'Extractor@stable', config: { inference_profile: profile.id } },
                audio: { config: { inference_profile: profile.id } },
                video: { config: { inference_profile: profile.id } },
            },
        });
    });
    it('supports conversion profile selection, explicit bypass and returning to inheritance', async () => {
        const user = userEvent.setup();
        render(<Form section="conversion" />);
        const select = screen.getByRole('combobox', { name: 'Model: Inference profile' });
        await user.selectOptions(select, profile.id);
        expect((screen.getByLabelText('Environment') as HTMLInputElement).disabled).toBe(true);
        await user.selectOptions(select, '__bypass__');
        expect(
            JSON.parse(screen.getByTestId('policy').textContent ?? '{}').text_conversion.config.inference_profile,
        ).toBeNull();
        await user.selectOptions(select, '__inherit__');
        expect(JSON.parse(screen.getByTestId('policy').textContent ?? '{}')).toEqual({});
    });
    it('preserves unavailable profile references and disables controls when readonly', () => {
        const existing = 'c'.repeat(24);
        render(
            <Form
                readonly
                error
                initial={{ media_analysis: { image: { config: { inference_profile: existing } } } }}
            />,
        );
        expect(
            (screen.getByRole('combobox', { name: 'Image analysis: Inference profile' }) as HTMLSelectElement).value,
        ).toBe(existing);
        expect(
            (screen.getByRole('combobox', { name: 'Image analysis: Inference profile' }) as HTMLSelectElement).disabled,
        ).toBe(true);
        expect(screen.getAllByText(/Profiles could not be loaded/)).toHaveLength(3);
    });
});
