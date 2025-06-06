import { Table, TBody, Spinner } from "@vertesia/ui/core";
import { ContentObjectItem, ColumnLayout } from "@vertesia/common";
import clsx from "clsx";
import { ChangeEvent } from "react";
import { DocumentIcon } from "../components/DocumentIcon";
import { DocumentSelection } from "../DocumentSelectionProvider";
import { DocumentTableColumn } from "./DocumentTableColumn";

interface ViewProps {
    objects: ContentObjectItem[];
    isLoading: boolean;
    layout?: ColumnLayout[];
    onRowClick?: (object: ContentObjectItem) => void;
    onSelectionChange: ((object: ContentObjectItem, ev: ChangeEvent<HTMLInputElement>) => void);
    selection: DocumentSelection;
    toggleAll?: (ev: ChangeEvent<HTMLInputElement>) => void;
    columns: DocumentTableColumn[];
}

export function DocumentTableView({ objects, selection, isLoading, onRowClick, columns, toggleAll, onSelectionChange }: ViewProps) {
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
            <TBody isLoading={isLoading} columns={columns.length}>
                {
                    objects?.map((obj: ContentObjectItem) => {
                        return (
                            <tr key={obj.id} className='cursor-pointer hover:bg-muted' onClick={() => {
                                onRowClick && onRowClick(obj)
                            }}>
                                {selection &&
                                    <td onClick={ev => ev.stopPropagation()}>
                                        <input checked={selection.isSelected(obj.id)} type="checkbox"
                                            onChange={(ev: ChangeEvent<HTMLInputElement>) => onSelectionChange(obj, ev)} />
                                    </td>
                                }
                                {columns.map((col, index) => col.render(obj, index))}
                            </tr>
                        )
                    })
                }
                {objects.length === 0 && <tr><td colSpan={columns.length + (selection ? 1 : 0)} className="text-center">No objects. Just drag and drop documents or images here to create content objects.</td></tr>}
            </TBody>
        </Table>
    )
}

export function DocumentGridView({ objects, selection, isLoading, onSelectionChange }: ViewProps) {

    return (
        <>
            <div className={clsx("bg-white opacity-40 absolute inset-0 z-50 flex justify-center items-center", isLoading ? "block" : "hidden")}>
                <Spinner size='xl' />
            </div>
            <div className="w-full gap-2 grid lg:grid-cols-6">
                {objects.map((document) => (
                    <DocumentIcon key={document.id} document={document} selection={selection} onSelectionChange={onSelectionChange} />
                ))}
            </div>
        </>
    )
}