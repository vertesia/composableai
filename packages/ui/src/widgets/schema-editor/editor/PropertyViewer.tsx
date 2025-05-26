import { DataViewerProps } from "./Editable.js";
import { EditableSchemaProperty } from "./EditableSchemaProperty.js";

export function PropertyViewer({ value }: DataViewerProps<EditableSchemaProperty>) {
    if (!value) return null;
    return (
        <div
            className='w-full flex items-baseline'>
            <div>
                {value.name || ''}
            </div>
            <div className='ml-2 text-sm text-gray-400'>{value.type || ''}</div>
        </div>
    )
}
