import type { JSONObject } from "@vertesia/json";

import { JSONCode } from './JSONCode.js';
import { JSONView } from './JSONView.js';


interface JSONDisplayProps {
    value: JSONObject;
    viewCode?: boolean;
}
export function JSONDisplay({ value, viewCode = false }: JSONDisplayProps) {

    if (!value) {
        return (
            <pre className="whitespace-pre-wrap">No Data to display</pre>
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