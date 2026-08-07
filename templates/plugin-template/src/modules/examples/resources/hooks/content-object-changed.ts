import type { AppEventHook } from '@vertesia/tools-sdk';

function stringValue(value: unknown): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export const contentObjectChanged: AppEventHook = async ({ delivery, event }) => {
    const documentId = stringValue(event.resource_data?.id) ?? event.resource_id;
    const documentTitle = stringValue(event.resource_data?.name) ?? 'Untitled content object';

    console.info('[examples] content object changed hook called', {
        action: event.action,
        deliveryId: delivery.id,
        documentId,
        documentTitle,
    });

    return {
        message: `Example content object hook processed "${documentTitle}".`,
        data: {
            action: event.action,
            document_id: documentId,
            document_title: documentTitle,
        },
    };
};
