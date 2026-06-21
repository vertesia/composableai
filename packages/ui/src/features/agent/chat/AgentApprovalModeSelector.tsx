import type { AgentToolApprovalMode } from '@vertesia/common';
import {
    Button,
    cn,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
    Modal,
    ModalBody,
    ModalFooter,
    ModalTitle,
} from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { ChevronDownIcon, HandIcon, ShieldAlertIcon, ShieldCheckIcon } from 'lucide-react';
import type React from 'react';
import { useMemo, useState } from 'react';

interface ApprovalModeOption {
    mode: AgentToolApprovalMode;
    label: string;
    description: string;
    icon: React.ReactNode;
}

export interface AgentApprovalModeSelectorProps {
    mode: AgentToolApprovalMode;
    onChange: (mode: AgentToolApprovalMode) => void;
    disabled?: boolean;
    className?: string;
}

function getModeClassName(mode: AgentToolApprovalMode) {
    if (mode === 'full_control') return 'text-attention hover:text-attention';
    if (mode === 'ask') return 'text-muted hover:text-foreground';
    return 'text-info hover:text-info';
}

function getModeIcon(mode: AgentToolApprovalMode) {
    if (mode === 'full_control') return <ShieldAlertIcon className="size-4" />;
    if (mode === 'ask') return <HandIcon className="size-4" />;
    return <ShieldCheckIcon className="size-4" />;
}

export function AgentApprovalModeSelector({
    mode,
    onChange,
    disabled = false,
    className,
}: AgentApprovalModeSelectorProps) {
    const { t } = useUITranslation();
    const [confirmFullControlOpen, setConfirmFullControlOpen] = useState(false);

    const options = useMemo<ApprovalModeOption[]>(
        () => [
            {
                mode: 'ask',
                label: t('agent.approvalMode.ask'),
                description: t('agent.approvalMode.askDescription'),
                icon: <HandIcon className="size-4" />,
            },
            {
                mode: 'auto_review',
                label: t('agent.approvalMode.autoReview'),
                description: t('agent.approvalMode.autoReviewDescription'),
                icon: <ShieldCheckIcon className="size-4" />,
            },
            {
                mode: 'full_control',
                label: t('agent.approvalMode.fullControl'),
                description: t('agent.approvalMode.fullControlDescription'),
                icon: <ShieldAlertIcon className="size-4" />,
            },
        ],
        [t],
    );

    const selected = options.find((option) => option.mode === mode) ?? options[2];

    const selectMode = (nextMode: AgentToolApprovalMode) => {
        if (nextMode === mode) return;
        if (nextMode === 'full_control') {
            setConfirmFullControlOpen(true);
            return;
        }
        onChange(nextMode);
    };

    const confirmFullControl = () => {
        setConfirmFullControlOpen(false);
        onChange('full_control');
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={disabled}
                        className={cn(
                            'h-8 max-w-[13rem] rounded-full px-2.5 font-medium',
                            'bg-mixer-muted/15 hover:bg-muted disabled:opacity-60',
                            getModeClassName(mode),
                            className,
                        )}
                        aria-label={t('agent.approvalMode.selectorLabel')}
                        title={t('agent.approvalMode.selectorLabel')}
                    >
                        <span className="shrink-0">{getModeIcon(mode)}</span>
                        <span className="min-w-0 truncate">{selected.label}</span>
                        <ChevronDownIcon className="size-4 shrink-0 opacity-70" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="z-[1000000] w-[min(28rem,calc(100vw-1rem))] p-2">
                    <div className="px-2 pb-1.5 pt-1 text-sm font-medium text-foreground">
                        {t('agent.approvalMode.dropdownTitle')}
                    </div>
                    <DropdownMenuRadioGroup
                        value={mode}
                        onValueChange={(value) => selectMode(value as AgentToolApprovalMode)}
                    >
                        {options.map((option) => (
                            <DropdownMenuRadioItem
                                key={option.mode}
                                value={option.mode}
                                className="min-h-14 items-start gap-3 rounded-md py-2 pe-8 ps-2 text-start"
                            >
                                <span className={cn('mt-0.5 shrink-0', getModeClassName(option.mode))}>
                                    {option.icon}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-medium text-foreground">{option.label}</span>
                                    <span className="mt-0.5 block whitespace-normal text-sm leading-5 text-muted">
                                        {option.description}
                                    </span>
                                </span>
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
            </DropdownMenu>

            <Modal
                isOpen={confirmFullControlOpen}
                onClose={() => setConfirmFullControlOpen(false)}
                className="max-w-md"
            >
                <ModalBody>
                    <ModalTitle>{t('agent.approvalMode.confirmFullControlTitle')}</ModalTitle>
                    <p className="mt-2 text-sm leading-6 text-muted">
                        {t('agent.approvalMode.confirmFullControlDescription')}
                    </p>
                    <ModalFooter>
                        <Button variant="ghost" onClick={() => setConfirmFullControlOpen(false)}>
                            {t('agent.approvalMode.cancel')}
                        </Button>
                        <Button
                            variant="unstyled"
                            size="md"
                            className="bg-attention text-background shadow-xs hover:bg-attention/85"
                            onClick={confirmFullControl}
                        >
                            {t('agent.approvalMode.confirmFullControl')}
                        </Button>
                    </ModalFooter>
                </ModalBody>
            </Modal>
        </>
    );
}
