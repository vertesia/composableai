import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { I18nProvider } from '../../../../i18n/index.js';
import renderers from '../layout/renderers';
import { ContentSourceIcon, externalSourceSystem } from './ContentSourceIcon';

describe('externalSourceSystem', () => {
    it.each([
        ['sharepoint://6af577/01ABC', 'sharepoint'],
        ['box://6af577/12345', 'box'],
        ['gs://bucket/file.pdf', undefined],
        ['', undefined],
        [undefined, undefined],
    ])('should map %s to %s', (source, system) => {
        expect(externalSourceSystem(source)).toBe(system);
    });
});

describe('ContentSourceIcon', () => {
    it('should label a SharePoint document', () => {
        render(
            <I18nProvider lng="en">
                <ContentSourceIcon source="sharepoint://6af577/01ABC" />
            </I18nProvider>,
        );
        expect(screen.getByRole('img', { name: 'Synced from SharePoint' })).toBeTruthy();
    });

    it('should render nothing for a document stored in Vertesia', () => {
        const { container } = render(
            <I18nProvider lng="en">
                <ContentSourceIcon source="gs://bucket/file.pdf" />
            </I18nProvider>,
        );
        expect(container.innerHTML).toBe('');
    });
});

describe('objectName renderer', () => {
    const renderName = (object: unknown) =>
        render(
            <I18nProvider lng="en">
                <table>
                    <tbody>
                        <tr>{renderers.objectName()(object, 0)}</tr>
                    </tbody>
                </table>
            </I18nProvider>,
        );

    it('should show the Box mark before the name of a synced document', () => {
        renderName({ id: 'o1', name: 'Budget.xlsx', content: { source: 'box://6af577/12345' } });
        expect(screen.getByRole('img', { name: 'Synced from Box' })).toBeTruthy();
        expect(screen.getByText('Budget.xlsx')).toBeTruthy();
    });

    it('should show no mark for a document stored in Vertesia', () => {
        renderName({ id: 'o2', name: 'Notes.pdf', content: { source: 'gs://bucket/notes.pdf' } });
        expect(screen.queryByRole('img')).toBeNull();
        expect(screen.getByText('Notes.pdf')).toBeTruthy();
    });
});
