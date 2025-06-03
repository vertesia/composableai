import { ContentObjectItem } from "@vertesia/common";
import { createContext, useContext, useEffect, useState } from "react";

export class ObjectSelection {
    /**
     * The collection id to which the selected objects belong to.
     */
    collectionId?: string | undefined;

    singleSelection = false;

    constructor(public object: ContentObjectItem | undefined, collectionId: string | undefined, public objects: Record<string, ContentObjectItem>, private setState: (selection: ObjectSelection) => void) {
        this.singleSelection = Object.keys(this.objects).length === 0;
        this.collectionId = collectionId;
    }

    isSingleSelection() {
        return this.singleSelection;
    }

    hasSelection() {
        return this.object !== undefined || this.size() !== 0;
    }

    size() {
        return Object.keys(this.objects).length;
    }

    getObjectIds() {
        return Object.keys(this.objects);
    }

    getObjectId() {
        return this.object?.id;
    }

    clone() {
        return new ObjectSelection(this.object, this.collectionId, this.objects, this.setState);
    }

    add(object: ContentObjectItem) {
        this.objects[object.id] = object;
        this.singleSelection = Object.keys(this.objects).length === 0;
        this.setState(this.clone());
    }

    remove(objectId: string) {
        delete this.objects[objectId];
        this.singleSelection = Object.keys(this.objects).length === 0;
        this.setState(this.clone());
    }

    addAll(objects: ContentObjectItem[]) {
        for (const obj of objects) {
            this.objects[obj.id] = obj;
        }
        this.setState(this.clone());
    }

    isSelected(objectId: string) {
        return this.objects[objectId] !== undefined;
    }

    removeAll() {
        this.objects = {};
        this.singleSelection = true;
        this.setState(this.clone());
    }
}

const SelectionContext = createContext<ObjectSelection>(undefined as any);

export function useObjectSelection() {
    const selection = useContext(SelectionContext);
    if (!selection) {
        throw new Error("useObjectSelection must be used within a ObjectSelectionProvider");
    }
    return selection;
}

export function useOptionalObjectSelection() {
    return useContext(SelectionContext);
}

interface ObjectSelectionProviderProps {
    children: React.ReactNode;
    collectionId?: string;
    value?: ContentObjectItem; // initial selection if any (for single selection purpose)
}
export function ObjectSelectionProvider({ value, collectionId, children }: ObjectSelectionProviderProps) {
    const [selection, setSelection] = useState<ObjectSelection>();
    useEffect(() => {
        const selection = new ObjectSelection(value, collectionId, {}, setSelection);
        setSelection(selection);
    }, [value]);
    return selection && (
        <SelectionContext.Provider value={selection}>{children}</SelectionContext.Provider>
    )
}