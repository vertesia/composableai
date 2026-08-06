import type { ContentObjectItem } from '@vertesia/common';

export interface GuideProperties {
    slug: string;
    title: string;
    summary: string;
    body: string;
    location_slug: string;
    category: string;
    status: 'draft' | 'in_review' | 'published';
    owner: string;
    audience: string;
    tags?: string[];
    seed_marker?: string;
}

export interface ReviewTaskProperties {
    slug: string;
    guide_slug: string;
    title: string;
    priority: 'low' | 'medium' | 'high';
    status: 'open' | 'in_progress' | 'done';
    assignee: string;
    checklist: string[];
    due_date: string;
    seed_marker?: string;
}

export interface GuideSummaryResult {
    summary: string;
    bullets: string[];
    recommended_status: 'draft' | 'in_review' | 'published';
    next_steps: string[];
}

export interface FieldSuggestionResult {
    suggestions: Array<{
        title: string;
        rationale: string;
        tags: string[];
    }>;
}

export type GuideObject = ContentObjectItem<GuideProperties>;
export type ReviewTaskObject = ContentObjectItem<ReviewTaskProperties>;

export function statusClass(status: string): string {
    if (status === 'published' || status === 'done') return 'text-success bg-mixer-success/10 border-success';
    if (status === 'in_review' || status === 'in_progress') {
        return 'text-attention bg-mixer-attention/10 border-attention';
    }
    return 'text-muted bg-mixer-muted/10 border-border';
}

export function priorityClass(priority: string): string {
    if (priority === 'high') return 'text-destructive bg-mixer-destructive/10 border-destructive';
    if (priority === 'medium') return 'text-attention bg-mixer-attention/10 border-attention';
    return 'text-muted bg-mixer-muted/10 border-border';
}
