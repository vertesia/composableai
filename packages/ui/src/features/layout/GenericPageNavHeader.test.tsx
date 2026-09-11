import { screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../__tests__/test-utils';
import { GenericPageNavHeader } from './GenericPageNavHeader';

vi.mock('@vertesia/ui/router', () => ({ useNavigate: () => vi.fn() }));

describe('GenericPageNavHeader breadcrumbs', () => {
    it.each(['Parent', null])('ignores non-array breadcrumbs: %s', (breadcrumbs) => {
        renderWithProviders(
            <GenericPageNavHeader
                title="Page"
                useDynamicBreadcrumbs={false}
                breadcrumbs={breadcrumbs as unknown as ComponentProps<typeof GenericPageNavHeader>['breadcrumbs']}
            />,
        );
        expect(screen.getByText('Page')).toBeDefined();
        expect(screen.queryByText('Parent')).toBeNull();
    });

    it('preserves breadcrumb elements', () => {
        renderWithProviders(
            <GenericPageNavHeader
                title="Page"
                useDynamicBreadcrumbs={false}
                breadcrumbs={[
                    <a key="parent" href="/parent">
                        Parent
                    </a>,
                ]}
            />,
        );
        expect(screen.getByText('Parent')).toBeDefined();
    });
});
