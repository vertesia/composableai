import type { ContentObjectTypeItem } from '@vertesia/common';
import { Badge, Button, CopyButton, Table, TableHeaderCell, TBody, THead, VTooltip } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useNavigate } from '@vertesia/ui/router';
import clsx from 'clsx';
import { Filter } from 'lucide-react';
import dayjs from '../../../core/utils/dayjs.js';
import { getContentObjectTypePresentation } from './contentObjectTypePresentation.js';

const ACTION_BTN_CLASS =
    'h-6 w-6 p-0 opacity-0 group-hover/field:opacity-100 text-muted hover:text-foreground transition-opacity shrink-0';

interface ContentObjectTypesTableProps {
    objects?: ContentObjectTypeItem[];
    isLoading: boolean;
    onFilter?: (field: string, value: string) => void;
    selectedIds?: string[];
    onToggleOne?: (id: string, checked: boolean) => void;
    allSelected?: boolean;
    onToggleAll?: (checked: boolean) => void;
}
export function ContentObjectTypesTable({
    objects,
    isLoading,
    onFilter,
    selectedIds,
    onToggleOne,
    allSelected,
    onToggleAll,
}: ContentObjectTypesTableProps) {
    const { t } = useUITranslation();
    const navigate = useNavigate();
    const selectable = !!onToggleOne;

    return (
        <Table className="w-full">
            <THead>
                <tr>
                    {selectable && (
                        <TableHeaderCell className="w-[5%]">
                            <input
                                type="checkbox"
                                checked={!!allSelected}
                                aria-label={t('store.actions.selectAllTypes')}
                                onChange={(e) => onToggleAll?.(e.target.checked)}
                            />
                        </TableHeaderCell>
                    )}
                    <TableHeaderCell>{t('store.name')}</TableHeaderCell>
                    <TableHeaderCell>{t('type.nature')}</TableHeaderCell>
                    <TableHeaderCell>{t('type.status')}</TableHeaderCell>
                    <TableHeaderCell>{t('store.strictMode')}</TableHeaderCell>
                    <TableHeaderCell>{t('store.semanticChunking')}</TableHeaderCell>
                    <TableHeaderCell>{t('store.updatedAt')}</TableHeaderCell>
                </tr>
            </THead>
            <TBody isLoading={isLoading && (!objects || objects.length === 0)} columns={selectable ? 7 : 6}>
                {objects?.map((obj) => {
                    const presentation = getContentObjectTypePresentation(obj.nature, obj.status);
                    return (
                        <tr
                            key={obj.id}
                            onClick={() => navigate(`/types/${obj.id}`)}
                            className="group cursor-pointer hover:bg-muted"
                        >
                            {selectable && (
                                <td className="w-[5%]">
                                    <input
                                        type="checkbox"
                                        className={clsx(
                                            'checkbox group-hover:inline-block',
                                            selectedIds?.includes(obj.id) ? 'inline-block' : 'hidden',
                                        )}
                                        checked={selectedIds?.includes(obj.id) ?? false}
                                        aria-label={t('store.actions.selectType', { name: obj.name })}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => onToggleOne?.(obj.id, e.target.checked)}
                                    />
                                </td>
                            )}
                            <td className="group/field">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="truncate">{obj.name}</span>
                                    <CopyButton content={obj.id} className={ACTION_BTN_CLASS} />
                                    {onFilter && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            title={`Filter by ${obj.name}`}
                                            className={ACTION_BTN_CLASS}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onFilter('name', obj.name);
                                            }}
                                        >
                                            <Filter className="size-3" />
                                        </Button>
                                    )}
                                </div>
                            </td>
                            <td>
                                <Badge variant="outline">{t(presentation.natureLabelKey)}</Badge>
                            </td>
                            <td>
                                <Badge variant={presentation.statusVariant}>{t(presentation.statusLabelKey)}</Badge>
                            </td>
                            <td>{obj.strict_mode ? 'Yes' : 'No'}</td>
                            <td>{obj.is_chunkable ? 'Yes' : 'No'}</td>
                            <td>
                                <VTooltip description={dayjs(obj.updated_at).format('YYYY-MM-DD HH:mm:ss')}>
                                    {dayjs(obj.updated_at).fromNow()}
                                </VTooltip>
                            </td>
                        </tr>
                    );
                })}
            </TBody>
        </Table>
    );
}
