import { useState } from 'react';
import {
    Button,
    Modal,
    ModalBody,
    ModalFooter,
    ModalTitle,
    Input,
    RadioGroup,
    RadioOptionAdapter,
    FormItem
} from '@vertesia/ui/core';

export interface SaveVersionConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (createVersion: boolean, versionLabel?: string) => Promise<void>;
    isLoading: boolean;
    uploadedFileName?: string; // Add this to show when an uploaded file is being used
}

// Define option type and adapter for RadioGroup
interface SaveOptionType {
    id: string;
    label: string;
    description: string;
}

class SaveOptionAdapter extends RadioOptionAdapter<SaveOptionType> {
    labelOf(item: SaveOptionType): string {
        return item.label;
    }

    idOf(item: SaveOptionType): string {
        return item.id;
    }

    renderOption(item: SaveOptionType): React.ReactNode {
        return (
            <div>
                <div className="font-medium">{item.label}</div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {item.description}
                </p>
            </div>
        );
    }
}

export function SaveVersionConfirmModal({ isOpen, onClose, onConfirm, isLoading, uploadedFileName }: SaveVersionConfirmModalProps) {
    const saveOptions: SaveOptionType[] = [
        {
            id: "update",
            label: "Update current version",
            description: uploadedFileName
                ? "Replace the content file and modify properties directly in the current revision."
                : "Modify the properties directly in the current revision."
        },
        {
            id: "new-version",
            label: "Create new version",
            description: uploadedFileName
                ? "Create a new revision with the replacement file while preserving the original."
                : "Create a new revision with these property changes while preserving the original."
        }
    ];

    const [selectedOption, setSelectedOption] = useState<SaveOptionType | undefined>(saveOptions[0]);
    const [versionLabel, setVersionLabel] = useState('');
    const optionAdapter = new SaveOptionAdapter();

    const createVersion = selectedOption?.id === "new-version";

    const handleOptionChange = (option: SaveOptionType) => {
        setSelectedOption(option);
    };

    const handleConfirm = async () => {
        await onConfirm(createVersion, createVersion ? versionLabel : undefined);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} className="sm:max-w-md">
            <ModalTitle>Save Changes</ModalTitle>
            <ModalBody>
                <div className="space-y-4">
                    {uploadedFileName && (
                        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                            <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                                You&apos;re about to replace the content file with: <span className="font-bold">{uploadedFileName}</span>
                            </p>
                        </div>
                    )}
                    <p className="text-sm text-mixer-muted/5">
                        How would you like to save these changes?
                    </p>

                    <RadioGroup
                        adapter={optionAdapter}
                        options={saveOptions}
                        value={selectedOption}
                        onChange={handleOptionChange}
                        gap="gap-4"
                    />

                    {createVersion && (
                        <FormItem
                            label="Version Label (Optional)"
                            description="Optional label for the new version."
                            className="mt-3 pl-8"
                        >
                            <Input
                                value={versionLabel}
                                onChange={setVersionLabel}
                                placeholder="e.g., v1.2, approved, post-review"
                                className="w-full"
                            />
                        </FormItem>
                    )}
                </div>
            </ModalBody>
            <ModalFooter>
                <Button variant="secondary" onClick={onClose} disabled={isLoading}>
                    Cancel
                </Button>
                <Button
                    variant="primary"
                    onClick={handleConfirm}
                    isLoading={isLoading}
                >
                    Save
                </Button>
            </ModalFooter>
        </Modal>
    );
}