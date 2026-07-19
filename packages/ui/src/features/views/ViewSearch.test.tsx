import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../__tests__/test-utils.js';
import { DefaultViewSearch } from './ViewSearch.js';

describe('DefaultViewSearch', () => {
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it('buckets structured fields and renders a typed range without browser completion', () => {
        const onKeyTermsChange = vi.fn();

        renderWithProviders(
            <DefaultViewSearch
                configuration={{
                    mode: 'deterministic',
                    placeholder: 'Find orders',
                    key_terms: [
                        {
                            id: 'purchase_order',
                            label: 'Purchase order',
                            field: 'properties.purchase_order',
                            type: 'keyword',
                            operator: 'term',
                        },
                        {
                            id: 'release_dates',
                            label: 'Release dates',
                            field: 'properties.release_date',
                            type: 'date',
                            operator: 'range',
                        },
                    ],
                }}
                query=""
                keyTerms={{ release_dates: ['2026-01-01..2026-01-31'] }}
                isLoading={false}
                onQueryChange={vi.fn()}
                onKeyTermsChange={onKeyTermsChange}
                onSubmit={vi.fn()}
            />,
        );

        expect(screen.getByText('Search fields')).not.toBeNull();
        expect(screen.getByText('Ranges')).not.toBeNull();

        const query = screen.getByPlaceholderText('Find orders') as HTMLInputElement;
        const purchaseOrder = screen.getByLabelText('Purchase order') as HTMLInputElement;
        const from = screen.getByLabelText('Release dates: From') as HTMLInputElement;
        const to = screen.getByLabelText('Release dates: To') as HTMLInputElement;

        expect(query.autocomplete).toBe('off');
        expect(purchaseOrder.autocomplete).toBe('off');
        expect(purchaseOrder.name).toBe('view-key-term-purchase_order');
        expect(from.type).toBe('date');
        expect(from.value).toBe('2026-01-01');
        expect(to.value).toBe('2026-01-31');

        fireEvent.change(from, { target: { value: '2026-01-05' } });

        expect(onKeyTermsChange).toHaveBeenCalledWith('release_dates', ['2026-01-05..2026-01-31']);
    });

    it('preserves unfinished spaces and separators while normalizing submitted key-term values', () => {
        const onKeyTermsChange = vi.fn();

        renderWithProviders(
            <DefaultViewSearch
                configuration={{
                    mode: 'deterministic',
                    key_terms: [
                        {
                            id: 'city',
                            label: 'City',
                            field: 'properties.city',
                            type: 'keyword',
                        },
                        {
                            id: 'customers',
                            label: 'Customers',
                            field: 'properties.customer',
                            type: 'keyword',
                            multiple: true,
                        },
                    ],
                }}
                query=""
                keyTerms={{}}
                isLoading={false}
                onQueryChange={vi.fn()}
                onKeyTermsChange={onKeyTermsChange}
                onSubmit={vi.fn()}
            />,
        );

        const city = screen.getByLabelText('City') as HTMLInputElement;
        fireEvent.focus(city);
        fireEvent.change(city, { target: { value: 'New York' } });
        expect(city.value).toBe('New York');
        expect(onKeyTermsChange).toHaveBeenCalledWith('city', ['New York']);

        const customers = screen.getByLabelText('Customers') as HTMLInputElement;
        fireEvent.focus(customers);
        fireEvent.change(customers, { target: { value: 'Acme, ' } });
        expect(customers.value).toBe('Acme, ');
        expect(onKeyTermsChange).toHaveBeenCalledWith('customers', ['Acme']);

        fireEvent.change(customers, { target: { value: 'Acme, Globex' } });
        expect(customers.value).toBe('Acme, Globex');
        expect(onKeyTermsChange).toHaveBeenCalledWith('customers', ['Acme', 'Globex']);
    });
});
