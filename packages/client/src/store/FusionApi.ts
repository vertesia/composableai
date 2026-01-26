/**
 * Fusion API Client
 *
 * Client API for managing AI-generated business applications and pages.
 */

import { ApiTopic, ClientBase } from '@vertesia/api-fetch-client';
import {
    CreateFusionApplicationPayload,
    CreateFusionPagePayload,
    FusionApplication,
    FusionApplicationItem,
    FusionApplicationStatus,
    FusionPage,
    FusionPageItem,
    FusionPageStatus,
    UpdateFusionApplicationPayload,
    UpdateFusionPagePayload,
} from '@vertesia/common';

// ============================================================================
// Response Types
// ============================================================================

/**
 * Paginated list response.
 */
export interface FusionListResponse<T> {
    items: T[];
    total: number;
    limit: number;
    offset: number;
}

/**
 * Query parameters for listing applications.
 */
export interface ListApplicationsQuery {
    /** Filter by status */
    status?: FusionApplicationStatus;
    /** Filter by tags (comma-separated) */
    tags?: string;
    /** Maximum results (default: 50, max: 100) */
    limit?: number;
    /** Pagination offset (default: 0) */
    offset?: number;
}

/**
 * Query parameters for listing pages.
 */
export interface ListPagesQuery {
    /** Filter by status */
    status?: FusionPageStatus;
    /** Filter by application ID */
    application?: string;
    /** Show only standalone pages (not linked to an application) */
    standalone?: boolean;
    /** Filter by tags (comma-separated) */
    tags?: string;
    /** Maximum results (default: 50, max: 100) */
    limit?: number;
    /** Pagination offset (default: 0) */
    offset?: number;
}

// ============================================================================
// Fusion API
// ============================================================================

/**
 * Client API for Fusion applications and pages.
 *
 * @example
 * ```typescript
 * // List applications
 * const apps = await client.store.fusion.applications.list();
 *
 * // Create an application
 * const app = await client.store.fusion.applications.create({
 *   name: 'inventory-app',
 *   title: 'Inventory Manager',
 *   navigation: { sidebar: [...] },
 *   routes: [{ path: '/', pageId: 'home' }],
 *   defaultRoute: '/'
 * });
 *
 * // Publish an application
 * await client.store.fusion.applications.publish(app.id);
 *
 * // Create a page
 * const page = await client.store.fusion.pages.create({
 *   name: 'products-list',
 *   title: 'Products',
 *   path: '/products',
 *   layout: { type: 'single' },
 *   regions: [{ id: 'main', content: [...] }],
 *   application: app.id
 * });
 * ```
 */
export class FusionApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/fusion');
    }

    /**
     * Applications API
     */
    applications = {
        /**
         * List fusion applications.
         *
         * @param query - Query parameters for filtering and pagination
         * @returns Paginated list of application summaries
         */
        list: (query?: ListApplicationsQuery): Promise<FusionListResponse<FusionApplicationItem>> => {
            const params = new URLSearchParams();
            if (query?.status) params.set('status', query.status);
            if (query?.tags) params.set('tags', query.tags);
            if (query?.limit) params.set('limit', String(query.limit));
            if (query?.offset) params.set('offset', String(query.offset));
            const qs = params.toString();
            return this.get('/applications' + (qs ? '?' + qs : ''));
        },

        /**
         * Create a new fusion application.
         *
         * @param payload - Application configuration
         * @returns The created application
         */
        create: (payload: CreateFusionApplicationPayload): Promise<FusionApplication> => {
            return this.post('/applications', { payload });
        },

        /**
         * Retrieve a fusion application by ID.
         *
         * @param id - Application ID
         * @returns The application with full details
         */
        retrieve: (id: string): Promise<FusionApplication> => {
            return this.get(`/applications/${id}`);
        },

        /**
         * Update a fusion application.
         *
         * @param id - Application ID
         * @param payload - Fields to update
         * @returns The updated application
         */
        update: (id: string, payload: UpdateFusionApplicationPayload): Promise<FusionApplication> => {
            return this.put(`/applications/${id}`, { payload });
        },

        /**
         * Archive (soft delete) a fusion application.
         *
         * @param id - Application ID
         * @returns Object with the archived application ID
         */
        delete: (id: string): Promise<{ id: string; status: 'archived' }> => {
            return this.del(`/applications/${id}`);
        },

        /**
         * Publish a fusion application.
         *
         * @param id - Application ID
         * @returns The published application
         */
        publish: (id: string): Promise<FusionApplication> => {
            return this.post(`/applications/${id}/publish`);
        },

        /**
         * Unpublish a fusion application (back to draft).
         *
         * @param id - Application ID
         * @returns The unpublished application
         */
        unpublish: (id: string): Promise<FusionApplication> => {
            return this.post(`/applications/${id}/unpublish`);
        },

        /**
         * Duplicate a fusion application.
         *
         * @param id - Application ID to duplicate
         * @param options - Options with name (required) and optional title
         * @returns The duplicated application
         */
        duplicate: (id: string, options: { name: string; title?: string }): Promise<FusionApplication> => {
            return this.post(`/applications/${id}/duplicate`, {
                payload: options,
            });
        },

        /**
         * List pages for a specific application.
         *
         * @param appId - Application ID
         * @param status - Optional status filter
         * @returns List of page summaries
         */
        listPages: (appId: string, status?: FusionPageStatus): Promise<{ items: FusionPageItem[] }> => {
            const qs = status ? `?status=${status}` : '';
            return this.get(`/applications/${appId}/pages${qs}`);
        },
    };

    /**
     * Pages API
     */
    pages = {
        /**
         * List fusion pages.
         *
         * @param query - Query parameters for filtering and pagination
         * @returns Paginated list of page summaries
         */
        list: (query?: ListPagesQuery): Promise<FusionListResponse<FusionPageItem>> => {
            const params = new URLSearchParams();
            if (query?.status) params.set('status', query.status);
            if (query?.application) params.set('application', query.application);
            if (query?.standalone) params.set('standalone', 'true');
            if (query?.tags) params.set('tags', query.tags);
            if (query?.limit) params.set('limit', String(query.limit));
            if (query?.offset) params.set('offset', String(query.offset));
            const qs = params.toString();
            return this.get('/pages' + (qs ? '?' + qs : ''));
        },

        /**
         * Create a new fusion page.
         *
         * @param payload - Page configuration
         * @returns The created page
         */
        create: (payload: CreateFusionPagePayload): Promise<FusionPage> => {
            return this.post('/pages', { payload });
        },

        /**
         * Retrieve a fusion page by ID.
         *
         * @param id - Page ID
         * @returns The page with full details
         */
        retrieve: (id: string): Promise<FusionPage> => {
            return this.get(`/pages/${id}`);
        },

        /**
         * Update a fusion page.
         *
         * @param id - Page ID
         * @param payload - Fields to update
         * @returns The updated page
         */
        update: (id: string, payload: UpdateFusionPagePayload): Promise<FusionPage> => {
            return this.put(`/pages/${id}`, { payload });
        },

        /**
         * Archive (soft delete) a fusion page.
         *
         * @param id - Page ID
         * @returns Object with the archived page ID
         */
        delete: (id: string): Promise<{ id: string; status: 'archived' }> => {
            return this.del(`/pages/${id}`);
        },

        /**
         * Publish a fusion page.
         *
         * @param id - Page ID
         * @returns The published page
         */
        publish: (id: string): Promise<FusionPage> => {
            return this.post(`/pages/${id}/publish`);
        },

        /**
         * Unpublish a fusion page (back to draft).
         *
         * @param id - Page ID
         * @returns The unpublished page
         */
        unpublish: (id: string): Promise<FusionPage> => {
            return this.post(`/pages/${id}/unpublish`);
        },

        /**
         * Duplicate a fusion page.
         *
         * @param id - Page ID to duplicate
         * @param options - Options with name (required) and optional title/path
         * @returns The duplicated page
         */
        duplicate: (id: string, options: { name: string; title?: string; path?: string }): Promise<FusionPage> => {
            return this.post(`/pages/${id}/duplicate`, {
                payload: options,
            });
        },

        /**
         * Move a page to a different application or make standalone.
         *
         * @param id - Page ID
         * @param application - Target application ID, or null for standalone
         * @param path - Optional new path
         * @returns The moved page
         */
        move: (id: string, application: string | null, path?: string): Promise<FusionPage> => {
            return this.post(`/pages/${id}/move`, {
                payload: { application, path },
            });
        },
    };
}
