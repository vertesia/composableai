import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { Button, Modal, ModalBody, ModalFooter, ModalTitle, Styles } from '@vertesia/ui/core';
import { Plus, Trash2 } from 'lucide-react';

interface EnumValuesDialogProps {
    isOpen: boolean;
    values: string[];
    onClose: () => void;
    onSave: (values: string[]) => void;
}

export function EnumValuesDialog({ isOpen, values, onClose, onSave }: EnumValuesDialogProps) {
    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <ModalTitle>Define Enum Values</ModalTitle>
            <EnumValuesForm values={values} onSave={onSave} onClose={onClose} />
        </Modal>
    );
}

interface EnumValuesFormProps {
    values: string[];
    onSave: (values: string[]) => void;
    onClose: () => void;
}

function EnumValuesForm({ values, onSave, onClose }: EnumValuesFormProps) {
    const [currentValues, setCurrentValues] = useState<string[]>([]);
    const lastInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // Ensure at least one empty input
        setCurrentValues(values.length > 0 ? [...values] : ['']);
    }, [values]);

    useEffect(() => {
        // Focus the last input when a new one is added
        lastInputRef.current?.focus();
    }, [currentValues.length]);

    const handleAddValue = () => {
        setCurrentValues([...currentValues, '']);
    };

    const handleRemoveValue = (index: number) => {
        if (currentValues.length > 1) {
            setCurrentValues(currentValues.filter((_, i) => i !== index));
        }
    };

    const handleValueChange = (index: number, newValue: string) => {
        const updated = [...currentValues];
        updated[index] = newValue;
        setCurrentValues(updated);
    };

    const handleSave = () => {
        const cleaned = currentValues.map(v => v.trim()).filter(v => v.length > 0);
        onSave(cleaned);
        onClose();
    };

    const handleKeyDown = (e: KeyboardEvent, _index: number) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddValue();
        }
    };

    return (
        <>
            <ModalBody className="max-h-[60vh] overflow-y-auto">
                <div className="flex flex-col gap-2">
                    {currentValues.map((value, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <input
                                ref={index === currentValues.length - 1 ? lastInputRef : undefined}
                                type="text"
                                value={value}
                                onChange={(e) => handleValueChange(index, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, index)}
                                className={Styles.INPUT}
                                placeholder={`Value ${index + 1}`}
                            />
                            <Button
                                variant="ghost"
                                size="xs"
                                onClick={() => handleRemoveValue(index)}
                                disabled={currentValues.length <= 1}
                            >
                                <Trash2 className="size-4" />
                            </Button>
                        </div>
                    ))}
                </div>
                <Button variant="secondary" size="sm" onClick={handleAddValue} className="mt-3">
                    <Plus className="size-4 mr-1" /> Add Value
                </Button>
            </ModalBody>
            <ModalFooter>
                <Button onClick={handleSave}>Save</Button>
                <Button variant="secondary" onClick={onClose}>Cancel</Button>
            </ModalFooter>
        </>
    );
}
