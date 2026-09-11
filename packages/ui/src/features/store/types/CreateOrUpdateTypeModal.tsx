import type { ContentObjectTypeNature, RelationshipTypeConfiguration } from '@vertesia/common';
import {
    Button,
    FormItem,
    Input,
    Modal,
    ModalBody,
    ModalFooter,
    ModalTitle,
    Textarea,
    useToast,
} from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { useState } from 'react';

export interface CreateOrUpdateTypePayload {
    name: string;
    description?: string;
    strict_mode?: boolean;
    nature?: ContentObjectTypeNature;
    relationship?: RelationshipTypeConfiguration;
}
interface CreateOrUpdateTypeModalProps {
    title: string;
    isOpen: boolean;
    onClose: (payload?: CreateOrUpdateTypePayload) => Promise<unknown>;
    okLabel: string;
    initialPayload?: CreateOrUpdateTypePayload;
    isLoading?: boolean;
}
export function CreateOrUpdateTypeModal({
    title,
    isOpen,
    onClose,
    okLabel,
    initialPayload,
    isLoading,
}: CreateOrUpdateTypeModalProps) {
    const { t } = useUITranslation();
    const toast = useToast();
    const [name, setName] = useState<string | undefined>(initialPayload?.name);
    const [description, setDescription] = useState<string | undefined>(initialPayload?.description);
    const strictMode = initialPayload?.strict_mode ?? false;
    const [nature, setNature] = useState<ContentObjectTypeNature>(initialPayload?.nature ?? 'document');
    const [sourceTypes, setSourceTypes] = useState(initialPayload?.relationship?.source?.types?.join(', ') ?? '');
    const [targetTypes, setTargetTypes] = useState(initialPayload?.relationship?.target?.types?.join(', ') ?? '');
    const [sourceNatures, setSourceNatures] = useState(
        initialPayload?.relationship?.source?.natures?.join(', ') ?? 'subject, document',
    );
    const [targetNatures, setTargetNatures] = useState(
        initialPayload?.relationship?.target?.natures?.join(', ') ?? 'subject, document',
    );

    const onSave = () => {
        if (!name) {
            toast({
                status: 'error',
                title: t('type.nameRequired'),
                duration: 5000,
            });
            return;
        }
        const values = (value: string) =>
            value
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean);
        const allowedNatures = new Set<ContentObjectTypeNature>(['document', 'dynamic', 'subject', 'relationship']);
        const natures = (value: string) =>
            values(value).filter((item): item is ContentObjectTypeNature =>
                allowedNatures.has(item as ContentObjectTypeNature),
            );
        const payload = {
            name,
            description,
            strict_mode: strictMode,
            nature,
            relationship:
                nature === 'relationship'
                    ? {
                          source: { natures: natures(sourceNatures), types: values(sourceTypes) },
                          target: { natures: natures(targetNatures), types: values(targetTypes) },
                      }
                    : undefined,
        };
        void onClose(payload).then(() => onClose());
    };

    return (
        <Modal isOpen={isOpen} onClose={() => onClose()}>
            <ModalTitle>{title}</ModalTitle>
            <ModalBody className="pt-0">
                <div className="h-full flex flex-col gap-4 content-between">
                    <div>
                        <div className="block text-sm font-medium text-muted">{t('type.name')}</div>
                        <Input value={name} onChange={setName} />
                    </div>
                    <FormItem label={t('type.nature')}>
                        <select
                            className="w-full rounded border border-muted bg-background px-3 py-2 text-foreground"
                            value={nature}
                            onChange={(event) => setNature(event.target.value as ContentObjectTypeNature)}
                        >
                            <option value="document">{t('type.natureDocument')}</option>
                            <option value="dynamic">{t('type.natureDynamic')}</option>
                            <option value="subject">{t('type.natureSubject')}</option>
                            <option value="relationship">{t('type.natureRelationship')}</option>
                        </select>
                    </FormItem>
                    {nature === 'relationship' && (
                        <div className="grid grid-cols-2 gap-4">
                            <FormItem label={`${t('type.natureRelationship')} source natures`}>
                                <Input value={sourceNatures} onChange={setSourceNatures} />
                            </FormItem>
                            <FormItem label={`${t('type.natureRelationship')} target natures`}>
                                <Input value={targetNatures} onChange={setTargetNatures} />
                            </FormItem>
                            <FormItem label="Source content type IDs">
                                <Input value={sourceTypes} onChange={setSourceTypes} />
                            </FormItem>
                            <FormItem label="Target content type IDs">
                                <Input value={targetTypes} onChange={setTargetTypes} />
                            </FormItem>
                        </div>
                    )}
                    <div>
                        <div className="block text-sm font-medium text-muted">{t('type.description')}</div>
                        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} minLines={5} />
                    </div>
                </div>
            </ModalBody>
            <ModalFooter>
                <div className="flex justify-end gap-4">
                    <Button variant="secondary" onClick={() => onClose()}>
                        {t('modal.cancel')}
                    </Button>
                    <Button variant="primary" onClick={() => onSave()} isLoading={isLoading}>
                        {okLabel}
                    </Button>
                </div>
            </ModalFooter>
        </Modal>
    );
}
