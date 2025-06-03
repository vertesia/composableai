import { ContentObjectItem } from "@vertesia/common";
import { createContext, useContext, useEffect, useState } from "react";

export class DocumentSelection {
    /**
     * The collection id to which the selected objects belong to.
     */
    collectionId?: string | undefined;

    singleSelection = false;

    constructor(public object: ContentObjectItem | undefined, collectionId: string | undefined, public objects: Record<string, ContentObjectItem>, private setState: (selection: DocumentSelection) => void) {
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
        return new DocumentSelection(this.object, this.collectionId, this.objects, this.setState);
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

const DocumentSelectionContext = createContext<DocumentSelection>(undefined as any);

export function useDocumentSelection() {
    const selection = useContext(DocumentSelectionContext);
    if (!selection) {
        throw new Error("useObjectSelection must be used within a ObjectSelectionProvider");
    }
    return selection;
}

export function useOptionalDocumentSelection() {
    return useContext(DocumentSelectionContext);
}

interface DocumentSelectionProviderProps {
    children: React.ReactNode;
    collectionId?: string;
    value?: ContentObjectItem; // initial selection if any (for single selection purpose)
}
export function DocumentSelectionProvider({ value, collectionId, children }: DocumentSelectionProviderProps) {
    const [selection, setSelection] = useState<DocumentSelection>();
    useEffect(() => {
        const selection = new DocumentSelection(value, collectionId, {}, setSelection);
        setSelection(selection);
    }, [value]);
    return selection && (
        <DocumentSelectionContext.Provider value={selection}>{children}</DocumentSelectionContext.Provider>
    )
}