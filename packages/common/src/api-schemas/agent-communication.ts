import { z } from 'zod';
import { UserChannelSchema } from './interaction.js';
import { TaskFieldSchema } from './task.js';

export const EmailRouteDataSchema = z
    .strictObject({
        runId: z.string(),
        accountId: z.string(),
        projectId: z.string(),
        threadSubject: z.string().optional(),
        inReplyTo: z.string().optional(),
        references: z.array(z.string()).optional(),
        userEmail: z.string(),
        inboundDomain: z.string(),
    })
    .meta({ id: 'EmailRouteData' });

export const SendEmailRequestSchema = z
    .strictObject({
        to_email: z.string(),
        subject: z.string(),
        body: z.string(),
        agent_name: z.string(),
        from_name: z.string().optional(),
        run_id: z.string(),
        route_key: z.string().optional(),
        in_reply_to: z.string().optional(),
        references: z.array(z.string()).optional(),
    })
    .meta({ id: 'SendEmailRequest' });

export const SendEmailResponseSchema = z
    .strictObject({
        success: z.boolean(),
        email_id: z.string().optional(),
        message_id: z.string().optional(),
        route_key: z.string().optional(),
        error: z.string().optional(),
    })
    .meta({ id: 'SendEmailResponse' });

export const ResolveEmailRouteRequestSchema = z
    .strictObject({ route_key: z.string() })
    .meta({ id: 'ResolveEmailRouteRequest' });

export const CreateEmailRouteRequestSchema = z
    .strictObject({
        run_id: z.string(),
        user_email: z.string(),
        thread_subject: z.string().optional(),
    })
    .meta({ id: 'CreateEmailRouteRequest' });

export const CreateEmailRouteResponseSchema = z
    .strictObject({
        route_key: z.string(),
        reply_to: z.string(),
        email_domain: z.string(),
    })
    .meta({ id: 'CreateEmailRouteResponse' });

export const EmailRouteResponseSchema = EmailRouteDataSchema.extend({ route_key: z.string() }).meta({
    id: 'EmailRouteResponse',
});

export const UpdateEmailRouteRequestSchema = EmailRouteDataSchema.pick({
    threadSubject: true,
    inReplyTo: true,
    references: true,
    userEmail: true,
})
    .partial()
    .meta({ id: 'UpdateEmailRouteRequest' });

export const UpdateEmailRouteResponseSchema = z
    .strictObject({ success: z.boolean(), route_key: z.string() })
    .meta({ id: 'UpdateEmailRouteResponse' });

export const ForwardEmailRequestSchema = z
    .strictObject({
        email: z.strictObject({
            from: z.string(),
            subject: z.string().optional(),
            text: z.string(),
            html: z.string().optional(),
            message_id: z.string().optional(),
        }),
        context: z.record(z.string(), z.unknown()).optional(),
        attachments: z
            .array(
                z.strictObject({
                    filename: z.string(),
                    content_type: z.string(),
                    size: z.number(),
                    download_url: z.string(),
                }),
            )
            .optional(),
    })
    .meta({ id: 'ForwardEmailRequest' });

export const ForwardEmailResponseSchema = z
    .strictObject({
        success: z.boolean(),
        run_id: z.string(),
        workflow_id: z.string(),
        route_key: z.string(),
    })
    .meta({ id: 'ForwardEmailResponse' });

export const PendingAskStatusSchema = z.enum(['pending', 'resolved', 'expired']).meta({ id: 'PendingAskStatus' });

export const PendingAskDataSchema = z
    .strictObject({
        askId: z.string(),
        runId: z.string(),
        workflowId: z.string(),
        projectId: z.string(),
        accountId: z.string(),
        agentName: z.string(),
        questions: z.array(z.string()),
        timeoutHours: z.number(),
        userChannels: z.array(UserChannelSchema),
        createdAt: z.number(),
        expiresAt: z.number(),
        status: PendingAskStatusSchema,
        taskId: z.string().optional(),
        resolvedAt: z.number().optional(),
        response: z.string().optional(),
    })
    .meta({ id: 'PendingAskData' });

export const RegisterPendingAskRequestSchema = z
    .strictObject({
        runId: z.string(),
        workflowId: z.string(),
        agentName: z.string(),
        questions: z.array(z.string()),
        timeoutHours: z.number().optional(),
        userChannels: z.array(UserChannelSchema),
        taskFields: z.array(TaskFieldSchema).optional(),
        /**
         * Id of the REQUEST_INPUT message carrying this ask (the `ask_user` tool-use id), so a
         * notified client can open the exact prompt. Optional: workers built before this field
         * still validate against the component.
         */
        requestId: z.string().optional(),
    })
    .meta({ id: 'RegisterPendingAskRequest' });

export const RegisterPendingAskResponseSchema = z
    .strictObject({
        success: z.boolean(),
        askId: z.string().optional(),
        webhookSent: z.boolean().optional(),
        error: z.string().optional(),
    })
    .meta({ id: 'RegisterPendingAskResponse' });

export const ResolvePendingAskRequestSchema = z
    .strictObject({ response: z.string() })
    .meta({ id: 'ResolvePendingAskRequest' });

export const ResolvePendingAskResponseSchema = z
    .strictObject({
        success: z.boolean(),
        webhookSent: z.boolean().optional(),
        waitDurationMs: z.number().optional(),
        error: z.string().optional(),
    })
    .meta({ id: 'ResolvePendingAskResponse' });

export const ListPendingAsksResponseSchema = z
    .strictObject({ asks: z.array(PendingAskDataSchema) })
    .meta({ id: 'ListPendingAsksResponse' });
