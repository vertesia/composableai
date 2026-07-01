import { useUITranslation } from '@vertesia/ui/i18n';
import { TriangleAlert } from 'lucide-react';
import type React from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { FormItem } from '../../FormItem';
import { Button } from '../button';
import { Checkbox } from '../checkbox';
import { Input } from '../input';
import { Modal, ModalFooter, ModalTitle } from './dialog';

interface ConfirmModalProps {
    title: string;
    content: string | React.ReactNode;
    onConfirm: () => void;
    onCancel: () => void;
    isOpen: boolean;
    isLoading?: boolean;
    /**
     * When set, the user must type this exact value into a confirmation input
     * before the Confirm button is enabled. Use for destructive, irreversible
     * actions (e.g. typing a principal's email before deleting their access).
     * Matching ignores leading/trailing whitespace but is case-sensitive.
     */
    confirmationValue?: string;
    /**
     * Label rendered above the confirmation input. Recommended whenever
     * `confirmationValue` is set so the user knows what to type. Ignored when
     * `confirmationValue` is not set.
     */
    confirmationLabel?: React.ReactNode;
    /** Placeholder for the confirmation input. Ignored when `confirmationValue` is not set. */
    confirmationPlaceholder?: string;
    /**
     * When true, the user must tick an acknowledgment checkbox before the Confirm button is enabled.
     * Use for destructive, irreversible actions (e.g. bulk deletes).
     */
    requireAcknowledge?: boolean;
    /** Label rendered next to the acknowledgment checkbox. Ignored when `requireAcknowledge` is not set. */
    acknowledgeLabel?: React.ReactNode;
}

export function ConfirmModal({
    title,
    content,
    onConfirm,
    onCancel,
    isOpen,
    isLoading,
    confirmationValue,
    confirmationLabel,
    confirmationPlaceholder,
    requireAcknowledge,
    acknowledgeLabel,
}: ConfirmModalProps) {
    const { t } = useUITranslation();
    const cancelButtonRef = useRef(null);
    const acknowledgeId = useId();
    const [typedValue, setTypedValue] = useState('');
    const [acknowledged, setAcknowledged] = useState(false);

    // Clear the typed confirmation / acknowledgment when the modal closes so a stale (possibly
    // matching) value can never carry into the next time it is opened.
    useEffect(() => {
        if (!isOpen) {
            setTypedValue('');
            setAcknowledged(false);
        }
    }, [isOpen]);

    const requiresConfirmation = !!confirmationValue;
    const typedMatches = !confirmationValue || typedValue.trim() === confirmationValue.trim();
    const isConfirmed = typedMatches && (!requireAcknowledge || acknowledged);

    const handleConfirm = () => {
        if (!isConfirmed || isLoading) return;
        onConfirm();
    };

    return (
        <Modal isOpen={isOpen} onClose={onCancel} description="Confirm Modal">
            <div className="sm:flex sm:items-start p-2">
                <div className="mx-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <TriangleAlert className="size-6 text-red-600" aria-hidden="true" />
                </div>
                <div className="mt-3 text-center sm:ms-4 sm:mt-0 sm:text-start">
                    <ModalTitle className="leading-6" show>
                        {title}
                    </ModalTitle>
                    <div className="mt-2">
                        <div className="prose text-sm text-gray-500">{content}</div>
                    </div>
                </div>
            </div>
            {requiresConfirmation && (
                <div className="px-2 pb-2 text-start">
                    <FormItem label={confirmationLabel ?? confirmationPlaceholder}>
                        <Input
                            autoFocus
                            value={typedValue}
                            onChange={setTypedValue}
                            placeholder={confirmationPlaceholder}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleConfirm();
                                }
                            }}
                        />
                    </FormItem>
                </div>
            )}
            {requireAcknowledge && (
                <div className="px-2 pb-2 text-start">
                    <label htmlFor={acknowledgeId} className="flex items-start gap-2 cursor-pointer text-sm">
                        <Checkbox
                            id={acknowledgeId}
                            checked={acknowledged}
                            onCheckedChange={(value) => setAcknowledged(value === true)}
                        />
                        <span>{acknowledgeLabel ?? 'I understand and confirm to continue.'}</span>
                    </label>
                </div>
            )}
            <ModalFooter align="right">
                <Button variant="destructive" onClick={handleConfirm} isLoading={isLoading} disabled={!isConfirmed}>
                    {t('modal.confirm')}
                </Button>
                <Button variant="outline" onClick={onCancel} ref={cancelButtonRef}>
                    {t('modal.cancel')}
                </Button>
            </ModalFooter>
        </Modal>
    );
}
