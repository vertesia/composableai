import { useState, ReactNode, useEffect } from "react";
import {
    Button,
    Modal,
    ModalBody,
    ModalFooter,
    ModalTitle,
    SelectBox,
} from "@vertesia/ui/core";
import { ContentObjectTypeItem } from "@vertesia/common";
import { useUserSession } from "@vertesia/ui/session";
import { CheckCircleIcon } from "lucide-react";

/**
 * Props for the SelectTypeModal component
 */
interface SelectContentTypeModalProps {
    /** Whether the modal is open */
    isOpen: boolean;
    /** Callback when the modal is closed */
    onClose: (typeId?: string | null | undefined) => void;
    /** Title for the modal */
    title?: string;
    /** Children to render in the modal */
    children?: ReactNode;
    /** Optional initial selected type */
    initialSelectedType?: ContentObjectTypeItem | null;
    /** Optional description text */
    description?: string;
    /** Label for the confirm button */
    confirmLabel?: string;
    /** Whether to allow the "None" option */
    allowNone?: boolean;
}

/**
 * A dedicated modal for selecting content types.
 *
 * This is a lightweight modal specifically for selecting a content type,
 * without any file upload functionality. Used for changing types, setting
 * types in other contexts, etc.
 */
export function SelectContentTypeModal({
    isOpen,
    onClose,
    title = "Select Content Type",
    children,
    initialSelectedType = null,
    confirmLabel = "Select Type",
    allowNone = true,
}: SelectContentTypeModalProps) {
    const session = useUserSession();
    const [selectedType, setSelectedType] = useState<ContentObjectTypeItem | null>(initialSelectedType);
    const [types, setTypes] = useState<ContentObjectTypeItem[]>([]);

    // Load types when modal opens
    useEffect(() => {
        if (isOpen) {
            session.typeRegistry().then(registry => {
                setTypes(registry?.types || []);
            });
        }
    }, [isOpen, session]);

    // Handle close/cancel
    const handleClose = () => {
        onClose(undefined);
    };

    // Handle type selection and confirmation
    const handleConfirm = () => {
        onClose(selectedType?.id ?? null);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            className="w-full max-w-xl mx-auto"
        >
            <ModalTitle>{title}</ModalTitle>
            <ModalBody className="p-6">
                {children}

                {/* Type selection */}
                <div className="mb-4 mt-4">
                    <label className="block text-sm font-medium mb-2">
                        Content Type {allowNone && <span className="text-gray-500 font-normal">(Optional)</span>}
                    </label>
                    {allowNone ? (
                        <SelectBox
                            options={types}
                            value={selectedType}
                            optionLabel={(type) => type ? type.name : 'Select a content type'}
                            placeholder="Select a content type or leave empty for automatic detection"
                            onChange={(selected: ContentObjectTypeItem | null | undefined) => setSelectedType(selected || null)}
                            filterBy="name"
                            isClearable={true}
                        />
                    ) : (
                        <SelectBox
                            options={types}
                            value={selectedType}
                            optionLabel={(type) => type ? type.name : 'Select a content type'}
                            placeholder="Select a content type"
                            onChange={(selected: ContentObjectTypeItem | null | undefined) => setSelectedType(selected || null)}
                            filterBy="name"
                        />
                    )}

                    {allowNone && (
                        <div className="mt-2 text-sm text-blue-600 flex items-center">
                            <CheckCircleIcon className="h-4 w-4 mr-1" />
                            <span><strong>Type selection is optional.</strong> Leave empty to let Vertesia choose the appropriate type</span>
                        </div>
                    )}
                </div>

                {selectedType ? (
                    <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-md mb-4">
                        <div className="font-medium">{selectedType.name}</div>
                        {selectedType.description && (
                            <div className="mt-1">{selectedType.description}</div>
                        )}
                    </div>
                ) : allowNone && (
                    <div className="text-sm text-blue-600 bg-blue-50 p-3 rounded-md mb-4">
                        <div className="font-medium">Automatic Type Detection</div>
                        <div className="mt-1">
                            Vertesia will analyze each file&apos;s content and automatically select the most appropriate type.
                            <br />
                            <span className="mt-1 block font-medium">This is recommended for most uploads.</span>
                        </div>
                    </div>
                )}
            </ModalBody>
            <ModalFooter>
                <Button variant="ghost" onClick={handleClose}>
                    Cancel
                </Button>
                <Button
                    onClick={handleConfirm}
                >
                    {selectedType ? `${confirmLabel}: ${selectedType.name}` : allowNone ? "Let Vertesia Choose" : confirmLabel}
                </Button>
            </ModalFooter>
        </Modal>
    );
}