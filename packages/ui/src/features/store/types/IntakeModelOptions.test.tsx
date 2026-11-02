// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { InteractionExecutionConfiguration } from '@vertesia/common';
import { I18nProvider } from '@vertesia/ui/i18n';
import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { IntakeModelOptions } from './IntakeModelOptions.js';

const { retrieve } = vi.hoisted(() => ({ retrieve: vi.fn() }));
const client = { environments: { retrieve } };
vi.mock('@vertesia/ui/session', () => ({ useUserSession: () => ({ client, project: { id: 'project' } }) }));
vi.mock('@vertesia/ui/widgets', () => ({ JSONEditor: () => null }));
afterEach(cleanup);

function Harness({ readonly = false }: { readonly?: boolean }) {
    const [config, setConfig] = useState<InteractionExecutionConfiguration | undefined>({
        inference_profile: null,
        environment: 'env',
        model: 'gpt-4.1',
        do_validate: true,
    });
    return (
        <I18nProvider lng="en">
            {config && <IntakeModelOptions config={config} onChange={setConfig} readonly={readonly} />}
            <output data-testid="configuration">{JSON.stringify(config)}</output>
        </I18nProvider>
    );
}

it('edits the selected model options with the correct discriminator and preserves routing', async () => {
    retrieve.mockResolvedValue({ id: 'env', provider: 'openai' });
    render(<Harness />);
    const temperature = await screen.findByRole('spinbutton', { name: 'Temperature' });
    fireEvent.change(temperature, { target: { value: '0.25' } });
    await waitFor(() => {
        const config = JSON.parse(screen.getByTestId('configuration').textContent ?? '{}');
        expect(config.model_options.temperature).toBe(0.25);
        expect(config.model_options._option_id).toEqual(expect.any(String));
        expect(config).toMatchObject({
            inference_profile: null,
            environment: 'env',
            model: 'gpt-4.1',
            do_validate: true,
        });
    });
});

it('keeps model options read-only and does not write defaults on mount', async () => {
    retrieve.mockResolvedValue({ id: 'env', provider: 'openai' });
    render(<Harness readonly />);
    const temperature = await screen.findByRole('spinbutton', { name: 'Temperature' });
    expect((temperature as HTMLInputElement).disabled).toBe(true);
    expect(JSON.parse(screen.getByTestId('configuration').textContent ?? '{}')).not.toHaveProperty('model_options');
});
