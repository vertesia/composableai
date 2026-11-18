import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { SelectBox } from './selectBox';

interface Group {
    id: string;
    name: string;
    description: string;
}

const groups: Group[] = [
    { id: '1', name: 'DEV_ADMINS', description: 'Developers' },
    { id: '2', name: 'testers', description: 'Group for Users to Test Apps' },
    { id: '3', name: 'ops', description: 'Operations' },
];

function renderGroups(filterBy: string | ((g: Group) => string)) {
    render(
        <SelectBox<Group>
            inline
            options={groups}
            optionLabel={(g) => g.name}
            filterBy={filterBy}
            by="id"
            onChange={() => {}}
        />,
    );
}

describe('SelectBox', () => {
    beforeAll(() => {
        // cmdk scrolls the active item into view; jsdom does not implement it
        Element.prototype.scrollIntoView ??= () => {};
    });

    it('matches a function filterBy case-insensitively', () => {
        renderGroups((g) => `${g.name} ${g.description}`);

        fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'dev' } });
        expect(screen.getByText('DEV_ADMINS')).toBeTruthy();
        expect(screen.queryByText('ops')).toBeNull();

        fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'Group' } });
        expect(screen.getByText('testers')).toBeTruthy();
        expect(screen.queryByText('DEV_ADMINS')).toBeNull();
    });

    it('matches a property filterBy case-insensitively', () => {
        renderGroups('name');

        fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'ADMINS' } });
        expect(screen.getByText('DEV_ADMINS')).toBeTruthy();
        expect(screen.queryByText('testers')).toBeNull();
    });

    it('shows and clears a saved value that is no longer offered', () => {
        const onChange = vi.fn();
        render(<SelectBox options={['default', 'reserved']} value="flex" onChange={onChange} isClearable />);

        expect(screen.getByRole('button', { name: 'flex' }).getAttribute('aria-invalid')).toBe('true');
        fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
        expect(onChange).toHaveBeenCalledWith(undefined);
    });
});
