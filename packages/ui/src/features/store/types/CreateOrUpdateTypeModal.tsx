import { useState } from 'react';

import { Button, Input, Modal, ModalBody, ModalFooter, ModalTitle, Switch, useToast, Textarea } from '@vertesia/ui/core';

export interface CreateOrUpdateTypePayload {
    name: string;
    description?: string;
    strict_mode?: boolean;
}
interface CreateOrUpdateTypeModalProps {
    title: string;
    isOpen: boolean;
    onClose: (payload?: CreateOrUpdateTypePayload) => Promise<unknown>;
    okLabel: string;
    initialPayload?: CreateOrUpdateTypePayload;
}
export function CreateOrUpdateTypeModal({ title, isOpen, onClose, okLabel, initialPayload }: CreateOrUpdateTypeModalProps) {
    const toast = useToast();
    const [name, setName] = useState<string | undefined>(initialPayload?.name);
    const [description, setDescription] = useState<string | undefined>(initialPayload?.description);
    const [strictMode, setStrictMode] = useState<boolean>(initialPayload?.strict_mode ?? false);

    const onSave = () => {
        if (!name) {
            toast({
                status: 'error',
                title: 'Name is required',
                duration: 5000
            })
            return;
        }
        const payload = { name, description, strict_mode: strictMode };
        onClose(payload).then(() => onClose());

        setName(undefined);
        setDescription(undefined);
        setStrictMode(false);
    };

    return (
        <Modal isOpen={isOpen} onClose={() => onClose()}>
            <ModalTitle>{title}</ModalTitle>
            <ModalBody className="pt-0">
                <div className='h-full flex flex-col gap-4 content-between'>
                    <div>
                        <label className="block text-sm font-medium text-muted">Name</label>
                        <Input value={name} onChange={setName} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-muted">Description</label>
                        <Textarea value={description} onChange={setDescription} />
                    </div>
                    <div className="flex items-center justify-between">
                        <label className="block text-sm font-medium text-muted-foreground">Strict Mode</label>
                        <Switch value={strictMode} onChange={setStrictMode} />
                    </div>
                    <div className="text-xs text-muted-foreground">
                        When enabled, objects will be validated against the schema at generation and save time.
                    </div>
                </div>
            </ModalBody>
            <ModalFooter>
                <div className='flex justify-end gap-4'>
                    <Button variant="secondary" onClick={() => onClose()}>Cancel</Button>
                    <Button variant="primary" onClick={() => onSave()}>{okLabel}</Button>
                </div>
            </ModalFooter>
        </Modal>
    )
}