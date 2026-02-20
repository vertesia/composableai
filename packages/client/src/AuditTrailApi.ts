import { ApiTopic, ClientBase } from '@vertesia/api-fetch-client';
import type { AuditTrailQuery, AuditTrailResponse } from '@vertesia/common';

export default class AuditTrailApi extends ApiTopic {

    constructor(parent: ClientBase) {
        super(parent, '/api/v1/audit-trail');
    }

    list(query?: AuditTrailQuery): Promise<AuditTrailResponse> {
        const params = new URLSearchParams();
        if (query?.actions?.length) params.set('actions', query.actions.join(','));
        if (query?.resourceTypes?.length) params.set('resourceTypes', query.resourceTypes.join(','));
        if (query?.resourceId) params.set('resourceId', query.resourceId);
        if (query?.principalId) params.set('principalId', query.principalId);
        if (query?.principalUserId) params.set('principalUserId', query.principalUserId);
        if (query?.projectId) params.set('projectId', query.projectId);
        if (query?.from) params.set('from', query.from);
        if (query?.to) params.set('to', query.to);
        if (query?.limit) params.set('limit', String(query.limit));
        if (query?.offset) params.set('offset', String(query.offset));
        const qs = params.toString();
        return this.get('/' + (qs ? '?' + qs : ''));
    }
}
