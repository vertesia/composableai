import type { AgentToolApprovalMode } from '@vertesia/common';
import {
    Button,
    cn,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { ChevronDownIcon, HandIcon, ShieldAlertIcon, ShieldCheckIcon } from 'lucide-react';
import type React from 'react';
import { useMemo } from 'react';

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

function getModeIconClassName(mode: AgentToolApprovalMode) {
    if (mode === 'full_control') return 'text-attention';
    if (mode === 'auto_review') return 'text-info';
    return 'text-muted';
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
        onChange(nextMode);
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    className={cn(
                        'h-8 max-w-[13rem] rounded-full px-2.5 font-medium',
                        'bg-mixer-muted/15 text-muted hover:bg-muted hover:text-foreground disabled:opacity-60',
                        className,
                    )}
                    aria-label={t('agent.approvalMode.selectorLabel')}
                    title={t('agent.approvalMode.selectorLabel')}
                >
                    <span className={cn('shrink-0', getModeIconClassName(mode))}>{getModeIcon(mode)}</span>
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
                            <span className={cn('mt-0.5 shrink-0', getModeIconClassName(option.mode))}>
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
    );
}
