import { VertesiaClient } from "@vertesia/client";
import { ToastFn } from "@vertesia/ui/core";
import { DocumentSearch } from '../search/DocumentSearchContext';
import { DocumentSelection } from '../DocumentSelectionProvider';

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
}

export interface ActionComponentTypeProps {
    action: ObjectsActionSpec,
    objectIds: string[],
    children?: React.ReactNode,
    // the collection id if the action is being performed on a collection
    collectionId?: string,
}
export type ActionComponentType = React.ComponentType<ActionComponentTypeProps>;
