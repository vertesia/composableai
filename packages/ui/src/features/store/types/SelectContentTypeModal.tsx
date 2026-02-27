import { useState, ReactNode } from "react";
import {
    Button,
    Modal,
    ModalBody,
    ModalFooter,
    ModalTitle,
    SelectBox,
    VTooltip,
} from "@vertesia/ui/core";
import { ContentObjectTypeItem } from "@vertesia/common";
import { useTypeRegistry } from "./TypeRegistryProvider.js";
import { CheckCircleIcon, Info } from "lucide-react";

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
    allowNone = true,
}: SelectContentTypeModalProps) {
    const { registry: typeRegistry } = useTypeRegistry();
    const [selectedType, setSelectedType] = useState<ContentObjectTypeItem | null>(initialSelectedType);

    // Get available types from the registry
    const types = typeRegistry?.types || [];

    // Handle close/cancel
    const handleClose = () => {
        onClose(undefined);
    };

    // Handle type selection and confirmation
    const handleConfirm = () => {
        onClose(selectedType?.id ?? null);
        setSelectedType(null);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            className="w-full max-w-xl mx-auto"
        >
            <ModalTitle>{title}</ModalTitle>
            <ModalBody>
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
                </div>

                {!selectedType && (
                    <div className="flex items-center text-attention">
                        <CheckCircleIcon className="size-4 mr-1" />
                        Automatic Type Detection
                        <VTooltip
                            description="Vertesia will analyze the content and select the most appropriate type. This is recommended for most uploads and ensures optimal processing."
                            placement="top" size="xs"
                        >
                            <Info className="size-3 ml-2" />
                        </VTooltip>
                    </div>
                )}
            </ModalBody>
            <ModalFooter>
                <Button variant="ghost" onClick={handleClose} alt="Cancel">
                    Cancel
                </Button>
                <Button onClick={handleConfirm} alt="Confirm selection">
                    Confirm
                </Button>
            </ModalFooter>
        </Modal>
    );
}