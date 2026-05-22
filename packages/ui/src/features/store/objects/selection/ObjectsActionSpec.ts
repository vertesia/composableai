import type { VertesiaClient } from "@vertesia/client";
import type { ColumnLayout, ContentObjectTypeItem } from "@vertesia/common";
import type { ToastFn } from "@vertesia/ui/core";
import type { DocumentSelection } from '../DocumentSelectionProvider';
import type { DocumentSearch } from '../search/DocumentSearchContext';

export interface ObjectsActionSpec {
    id: string;
    name: string;
    description?: string;
    confirm?: boolean;
    confirmationText?: string;
    component: ActionComponentType;
    hideInList?: boolean;
    destructive?: boolean;
}

export interface ObjectsActionParams {
    action: ObjectsActionSpec,
    client: VertesiaClient,
    selection: DocumentSelection,
    toast: ToastFn,
    search: DocumentSearch,
    table_layout?: ColumnLayout[],
    type?: ContentObjectTypeItem,
}

export interface ActionComponentTypeProps {
    action: ObjectsActionSpec,
    objectIds: string[],
    children?: React.ReactNode,
    // the collection id if the action is being performed on a collection
    collectionId?: string,
}
export type ActionComponentType = React.ComponentType<ActionComponentTypeProps>;
