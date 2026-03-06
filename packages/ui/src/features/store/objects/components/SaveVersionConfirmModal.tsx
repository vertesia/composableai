import { useState, useEffect } from 'react';
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
import { useUITranslation } from '@vertesia/ui/i18n';

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
    const { t } = useUITranslation();
    const saveOptions: SaveOptionType[] = [
        {
            id: "update",
            label: t('modal.saveVersion.updateCurrent'),
            description: uploadedFileName
                ? t('modal.saveVersion.updateWithFileDescription')
                : t('modal.saveVersion.updateDescription')
        },
        {
            id: "new-version",
            label: t('modal.saveVersion.createNew'),
            description: uploadedFileName
                ? t('modal.saveVersion.createWithFileDescription')
                : t('modal.saveVersion.createDescription')
        }
    ];

    // Default to "create new version" when replacing a file, "update current version" when editing properties
    const defaultOption = uploadedFileName ? saveOptions[1] : saveOptions[0];
    const [selectedOption, setSelectedOption] = useState<SaveOptionType | undefined>(defaultOption);
    const [versionLabel, setVersionLabel] = useState('');
    const optionAdapter = new SaveOptionAdapter();

    // Reset to default when modal opens or uploadedFileName changes
    useEffect(() => {
        if (isOpen) {
            setSelectedOption(defaultOption);
            setVersionLabel('');
        }
    }, [isOpen, uploadedFileName]);

    const createVersion = selectedOption?.id === "new-version";

    const handleOptionChange = (option: SaveOptionType) => {
        setSelectedOption(option);
    };

    const handleConfirm = async () => {
        await onConfirm(createVersion, createVersion ? versionLabel : undefined);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} className="sm:max-w-md">
            <ModalTitle>{t('modal.saveChanges')}</ModalTitle>
            <ModalBody>
                <div className="space-y-4">
                    {uploadedFileName && (
                        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                            <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                                {t('modal.saveVersion.replaceFile')} <span className="font-bold">{uploadedFileName}</span>
                            </p>
                        </div>
                    )}
                    <p className="text-sm text-mixer-muted/5">
                        {t('modal.saveVersion.howToSave')}
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
                            label={t('modal.saveVersion.versionLabel')}
                            description={t('modal.saveVersion.versionLabelDescription')}
                            className="mt-3 pl-8"
                        >
                            <Input
                                value={versionLabel}
                                onChange={setVersionLabel}
                                placeholder={t('modal.saveVersion.versionLabelPlaceholder')}
                                className="w-full"
                            />
                        </FormItem>
                    )}
                </div>
            </ModalBody>
            <ModalFooter>
                <Button variant="secondary" onClick={onClose} disabled={isLoading}>
                    {t('modal.cancel')}
                </Button>
                <Button
                    variant="primary"
                    onClick={handleConfirm}
                    isLoading={isLoading}
                >
                    {t('modal.save')}
                </Button>
            </ModalFooter>
        </Modal>
    );
}