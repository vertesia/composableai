import type { JSONValue } from "@vertesia/json";
import { useUITranslation } from "@vertesia/ui/i18n";

import { JSONCode } from './JSONCode.js';
import { JSONView } from './JSONView.js';


interface JSONDisplayProps {
    value: unknown;
    viewCode?: boolean;
}
export function JSONDisplay({ value, viewCode = false }: JSONDisplayProps) {
    const { t } = useUITranslation();

    if (!value) {
        return (
            <pre className="whitespace-pre-wrap">{t('misc.noData')}</pre>
        );
    }

    return (
        <div className='relative w-full h-full flex flex-col'>
            {viewCode || !isJSONValue(value)
                ? <JSONCode data={value} />
                : <div className="flex-1 min-h-0 overflow-auto"><JSONView value={value} /></div>
            }
        </div>
    )
}

function isJSONValue(value: unknown): value is JSONValue {
    if (value == null) {
        return true;
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return true;
    }
    if (Array.isArray(value)) {
        return value.every(isJSONValue);
    }
    if (typeof value === 'object') {
        return Object.values(value).every(isJSONValue);
    }
    return false;
}
