import { ColumnLayout, ContentObjectItem } from "@vertesia/common";
import { Table, TBody } from "@vertesia/ui/core";
import { CheckIcon } from "lucide-react";
import { ChangeEvent } from "react";
import { DocumentIcon, DocumentIconSkeleton } from "../components/DocumentIcon";
import { DocumentSelection } from "../DocumentSelectionProvider";
import { DocumentTableColumn } from "./DocumentTableColumn";

interface ViewProps {
    objects: ContentObjectItem[];
    isLoading: boolean;
    layout?: ColumnLayout[];
    onRowClick?: (object: ContentObjectItem) => void;
    highlightRow?: (item: ContentObjectItem) => boolean;
    previewObject?: (objectId: string) => void;
    selectedObject?: ContentObjectItem | null;
    onSelectionChange: ((object: ContentObjectItem, ev: ChangeEvent<HTMLInputElement>) => void);
    selection: DocumentSelection;
    toggleAll?: (ev: ChangeEvent<HTMLInputElement>) => void;
    columns: DocumentTableColumn[];
}

export function DocumentTableView({ objects, selection, isLoading, columns, onRowClick, highlightRow, selectedObject, toggleAll, onSelectionChange }: ViewProps) {
    return (
        <Table className="w-full border-t">
            <thead>
                <tr>
                    {selection && <th><input type="checkbox" onChange={toggleAll} /></th>}
                    {columns.map((col) => (
                        <th key={col.name}>{col.name}</th>
                    ))}
                </tr>
            </thead>
            <TBody isLoading={isLoading} columns={columns.length + 1}>
                {
                    objects?.map((obj: ContentObjectItem) => {
                        const isHighlighted = highlightRow?.(obj);
                        return (
                            <tr key={obj.id} className={`cursor-pointer hover:bg-muted group ${selectedObject?.id === obj.id ? 'bg-muted' : ''} ${isHighlighted ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`} onClick={() => {
                                onRowClick && onRowClick(obj)
                            }}>
                                {selection &&
                                    <td onClick={ev => ev.stopPropagation()}>
                                        <input checked={selection.isSelected(obj.id)} type="checkbox" className={`${!selection.isSelected(obj.id) ? 'hidden group-hover:block' : ''}`}
                                            onChange={(ev: ChangeEvent<HTMLInputElement>) => onSelectionChange(obj, ev)} />
                                    </td>
                                }
                                {columns.map((col, index) => col.render(obj, index))}
                                {isHighlighted && (
                                    <td className="w-8 text-center">
                                        <CheckIcon className="size-4 text-blue-600 dark:text-blue-400 inline-block" />
                                    </td>
                                )}
                            </tr>
                        )
                    })
                }
                {objects.length === 0 && <tr><td colSpan={columns.length + (selection ? 1 : 0)} className="text-center">No objects. Just drag and drop documents or images here to create content objects.</td></tr>}
            </TBody>
        </Table>
    )
}

export function DocumentGridView({ objects, selection, isLoading, onSelectionChange, onRowClick, highlightRow, previewObject, selectedObject }: ViewProps) {
    return (
        <>
            <DocumentIconSkeleton isLoading={isLoading} />
            <div className="w-full gap-2 grid xs:grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 @xs:grid-cols-1 @sm:grid-cols-2 @md:grid-cols-3 @lg:grid-cols-4">
                {
                    objects.map((document) => (
                        <DocumentIcon key={document.id} document={document} selection={selection} onSelectionChange={onSelectionChange} onRowClick={onRowClick} highlightRow={highlightRow} previewObject={previewObject} selectedObject={selectedObject} />
                    ))
                }
            </div>
        </>
    )
}
