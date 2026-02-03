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
        <div className='relative w-full h-full'>
            {viewCode ? <JSONCode data={value} /> : <JSONView value={value} />}
        </div>
    )
}