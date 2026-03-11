import type { JSONObject } from "@vertesia/json";
import { useUITranslation } from "@vertesia/ui/i18n";

import { JSONCode } from './JSONCode.js';
import { JSONView } from './JSONView.js';


interface JSONDisplayProps {
    value: JSONObject;
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
            {viewCode
                ? <JSONCode data={value} />
                : <div className="flex-1 min-h-0 overflow-auto"><JSONView value={value} /></div>
            }
        </div>
    )
}