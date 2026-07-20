import { useUITranslation } from '@vertesia/ui/i18n';
import type { DataViewerProps } from './Editable.js';
import type { EditableSchemaProperty } from './EditableSchemaProperty.js';

export function PropertyViewer({ value }: DataViewerProps<EditableSchemaProperty>) {
    const { t } = useUITranslation();
    if (!value) return null;
    const noExtract = value.extractable === false;
    return (
        <div className="w-full flex items-baseline gap-2 min-w-0">
            <div className="truncate">{value.name || ''}</div>
            <div className="text-sm text-muted shrink-0">{value.type || ''}</div>
            {noExtract && (
                <span
                    className="shrink-0 text-[10px] uppercase tracking-wide text-attention border border-attention/40 bg-attention/10 rounded px-1.5 py-0.5"
                    title={t('widgets.schema.extractFromDocumentHint')}
                >
                    {t('widgets.schema.noExtract')}
                </span>
            )}
        </div>
    );
}
