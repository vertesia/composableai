import { type AgentMessage, type AgentMessageDetails, AgentMessageType } from '@vertesia/common';
import { cn, VTooltip } from '@vertesia/ui/core';
import { useUITranslation } from '@vertesia/ui/i18n';
import { AlertCircle, Check, CheckCheck, Clock, type LucideIcon } from 'lucide-react';

export type MessageDeliveryStatusValue = NonNullable<AgentMessageDetails['_deliveryStatus']>;

interface MessageDeliveryStatusConfig {
    icon: LucideIcon;
    className: string;
}

const STATUS_CONFIG: Record<MessageDeliveryStatusValue, MessageDeliveryStatusConfig> = {
    sending: {
        icon: Clock,
        className: 'text-muted/70',
    },
    received: {
        icon: Check,
        className: 'text-info',
    },
    consumed: {
        icon: CheckCheck,
        className: 'text-success',
    },
    failed: {
        icon: AlertCircle,
        className: 'text-destructive',
    },
};

function isDeliveryStatus(value: unknown): value is MessageDeliveryStatusValue {
    return value === 'sending' || value === 'received' || value === 'consumed' || value === 'failed';
}

export function getMessageDeliveryStatus(message: AgentMessage): MessageDeliveryStatusValue | undefined {
    if (message.type !== AgentMessageType.QUESTION) return undefined;

    const status = message.details?._deliveryStatus;
    if (isDeliveryStatus(status)) return status;
    if (message.details?.ack) return 'consumed';
    return undefined;
}

function getDeliveryStatusLabel(
    t: ReturnType<typeof useUITranslation>['t'],
    status: MessageDeliveryStatusValue,
): string {
    switch (status) {
        case 'sending':
            return t('agent.messageSending');
        case 'received':
            return t('agent.messageReceived');
        case 'consumed':
            return t('agent.messageConsumed');
        case 'failed':
            return t('agent.messageFailed');
    }
    return status;
}

export function MessageDeliveryStatus({ message, className }: { message: AgentMessage; className?: string }) {
    const { t } = useUITranslation();
    const status = getMessageDeliveryStatus(message);
    if (!status) return null;

    const config = STATUS_CONFIG[status];
    const Icon = config.icon;
    const label = getDeliveryStatusLabel(t, status);

    return (
        <VTooltip description={label} asChild>
            <span
                aria-label={label}
                className={cn('inline-flex h-5 w-5 items-center justify-center', config.className, className)}
                role="img"
            >
                <Icon className="size-3.5" aria-hidden="true" />
            </span>
        </VTooltip>
    );
}
