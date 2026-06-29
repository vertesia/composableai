import type { ContentObjectTypeItem } from '@vertesia/common';
import { Button, CopyButton, Table, TBody, THead, VTooltip } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useNavigate } from '@vertesia/ui/router';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Filter } from 'lucide-react';

dayjs.extend(relativeTime);

const ACTION_BTN_CLASS =
    'h-6 w-6 p-0 opacity-0 group-hover/field:opacity-100 text-muted hover:text-foreground transition-opacity shrink-0';

interface ContentObjectTypesTableProps {
    objects?: ContentObjectTypeItem[];
    isLoading: boolean;
    onFilter?: (field: string, value: string) => void;
    hasCheckbox?: boolean;
    selectedIds?: string[];
    onToggle?: (id: string, checked: boolean) => void;
    onToggleAll?: (checked: boolean) => void;
}
export function ContentObjectTypesTable({
    objects,
    isLoading,
    onFilter,
    hasCheckbox,
    selectedIds,
    onToggle,
    onToggleAll,
}: ContentObjectTypesTableProps) {
    const { t } = useUITranslation();
    const navigate = useNavigate();

    const allSelected = !!objects?.length && objects.every((o) => selectedIds?.includes(o.id));

    return (
        <Table className="w-full">
            <THead>
                <tr>
                    {hasCheckbox && (
                        <th className="w-[5%]">
                            <input
                                type="checkbox"
                                checked={allSelected}
                                aria-label="Select all types"
                                onChange={(e) => onToggleAll?.(e.target.checked)}
                            />
                        </th>
                    )}
                    <th>{t('store.name')}</th>
                    <th>{t('store.strictMode')}</th>
                    <th>{t('store.semanticChunking')}</th>
                    <th>{t('store.updatedAt')}</th>
                </tr>
            </THead>
            <TBody isLoading={isLoading && (!objects || objects.length === 0)} columns={hasCheckbox ? 5 : 4}>
                {objects?.map((obj) => (
                    <tr
                        key={obj.id}
                        onClick={() => navigate(`/types/${obj.id}`)}
                        className="cursor-pointer hover:bg-muted group"
                    >
                        {hasCheckbox && (
                            <td className="w-[5%]">
                                <input
                                    type="checkbox"
                                    className={selectedIds?.includes(obj.id) ? '' : 'hidden group-hover:block'}
                                    checked={selectedIds?.includes(obj.id) ?? false}
                                    aria-label={`Select type ${obj.name}`}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => onToggle?.(obj.id, e.target.checked)}
                                />
                            </td>
                        )}
                        <td className="group/field">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="truncate">{obj.name}</span>
                                <CopyButton content={obj.id} className={ACTION_BTN_CLASS} />
                                {onFilter && (
                                    <VTooltip description={`Filter by ${obj.name}`} asChild size="xs">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            aria-label={`Filter by ${obj.name}`}
                                            className={ACTION_BTN_CLASS}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onFilter('name', obj.name);
                                            }}
                                        >
                                            <Filter className="size-3" />
                                        </Button>
                                    </VTooltip>
                                )}
                            </div>
                        </td>
                        <td>{obj.strict_mode ? 'Yes' : 'No'}</td>
                        <td>{obj.is_chunkable ? 'Yes' : 'No'}</td>
                        <td>
                            <VTooltip description={dayjs(obj.updated_at).format('YYYY-MM-DD HH:mm:ss')}>
                                {dayjs(obj.updated_at).fromNow()}
                            </VTooltip>
                        </td>
                    </tr>
                ))}
            </TBody>
        </Table>
    );
}
