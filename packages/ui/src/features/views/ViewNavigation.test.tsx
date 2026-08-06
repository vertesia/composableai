import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../__tests__/test-utils.js';
import { DefaultViewNavigation } from './ViewNavigation.js';

describe('DefaultViewNavigation', () => {
    afterEach(cleanup);

    it('keeps selected collection labels visible above the available nodes', () => {
        const onChange = vi.fn();
        renderWithProviders(
            <DefaultViewNavigation
                configuration={{ id: 'collections', label: 'Collections', source: 'collection' }}
                result={{
                    id: 'collections',
                    selected: ['selected-id'],
                    nodes: [
                        { id: 'selected-id', label: 'Priority orders', count: 12, selected: true },
                        { id: 'child-id', label: 'Escalated', count: 3 },
                    ],
                }}
                isLoading={false}
                onChange={onChange}
            />,
        );

        expect(screen.getAllByText('Priority orders')).toHaveLength(2);
        expect(screen.queryByText('selected-id')).toBeNull();
        fireEvent.click(screen.getByRole('checkbox', { name: /Priority orders/ }));
        expect(onChange).toHaveBeenCalledWith([]);
    });

    it('lets users remove a selected location after drill-down hides the parent node', () => {
        const onChange = vi.fn();
        renderWithProviders(
            <DefaultViewNavigation
                configuration={{ id: 'location', label: 'Location', source: 'location', multi_select: true }}
                result={{
                    id: 'location',
                    selected: ['/Customers/Acme'],
                    nodes: [{ id: '/Customers/Acme/Orders', label: 'Orders', count: 8 }],
                }}
                isLoading={false}
                onChange={onChange}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Remove /Customers/Acme' }));
        expect(onChange).toHaveBeenCalledWith([]);
    });

    it('renders property hierarchy buckets as drill-down choices with clickable breadcrumbs', () => {
        const onChange = vi.fn();
        renderWithProviders(
            <DefaultViewNavigation
                configuration={{
                    id: 'geography',
                    label: 'Geography',
                    source: 'hierarchy',
                    levels: [
                        { id: 'state', label: 'State', field: 'properties.state' },
                        { id: 'city', label: 'City', field: 'properties.city' },
                    ],
                }}
                result={{
                    id: 'geography',
                    selected: ['h1:florida'],
                    breadcrumbs: [{ id: 'h1:florida', label: 'FL', count: 0, selected: true }],
                    nodes: [
                        { id: 'h1:miami', label: 'Miami', count: 8 },
                        { id: 'h1:orlando', label: 'Orlando', count: 4 },
                    ],
                }}
                isLoading={false}
                onChange={onChange}
            />,
        );

        expect(screen.queryByText('h1:florida')).toBeNull();
        expect(screen.getByRole('navigation', { name: 'Geography path' })).not.toBeNull();
        fireEvent.click(screen.getByRole('button', { name: /Miami/ }));
        expect(onChange).toHaveBeenLastCalledWith(['h1:miami']);
        fireEvent.click(screen.getByRole('button', { name: 'FL' }));
        expect(onChange).toHaveBeenLastCalledWith(['h1:florida']);
    });
});
