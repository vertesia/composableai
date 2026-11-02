import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type {
    AuditAdoptionQuery,
    AuditAdoptionResponse,
    AuditAggregationBatchQuery,
    AuditAggregationBatchResponse,
    AuditAggregationQuery,
    AuditAggregationResponse,
    AuditTrailQuery,
    AuditTrailResponse,
    AuditUsageQuery,
    AuditUsageResponse,
} from '@vertesia/common';

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
        if (query?.principalType) params.set('principalType', query.principalType);
        if (query?.effectivePrincipalId) params.set('effectivePrincipalId', query.effectivePrincipalId);
        if (query?.hasEffectivePrincipal !== undefined)
            params.set('hasEffectivePrincipal', String(query.hasEffectivePrincipal));
        if (query?.projectId) params.set('projectId', query.projectId);
        if (query?.from) params.set('from', query.from);
        if (query?.to) params.set('to', query.to);
        if (query?.limit) params.set('limit', String(query.limit));
        if (query?.offset) params.set('offset', String(query.offset));
        const qs = params.toString();
        return this.get(`/${qs ? `?${qs}` : ''}`);
    }

    aggregate(query: AuditAggregationQuery): Promise<AuditAggregationResponse> {
        return this.post('/aggregate', { payload: query });
    }

    /**
     * Run several aggregations in one request. `results[i]` is what `aggregate(queries[i])` returns; the server
     * computes the queries that share a scope, time range and filter in one pass over the audit events.
     */
    aggregateBatch(queries: AuditAggregationQuery[]): Promise<AuditAggregationBatchResponse> {
        const payload: AuditAggregationBatchQuery = { queries };
        return this.post('/aggregate/batch', { payload });
    }

    adoption(query: AuditAdoptionQuery = {}): Promise<AuditAdoptionResponse> {
        return this.post('/adoption', { payload: query });
    }

    usage(query: AuditUsageQuery = {}): Promise<AuditUsageResponse> {
        return this.post('/usage', { payload: query });
    }
}
