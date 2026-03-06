export interface FindPayload {
    query: Record<string, any>;
    offset?: number;
    limit?: number;
    select?: string;
    all_revisions?: boolean;
    from_root?: string;
}


export interface GenericCommandResponse {
    status: string;
    message: string;
    err?: any;
    details?: any;
}

export interface BulkOperationPayload {
    /**
     * The operation name
     */
    name: "change_type" | "delete" | "start_workflow" | "update";

    /**
     * The IDs of the objects to operate on
     */
    ids: string[];

    /**
     * The operation parameters.
     */
    params: Record<string, any>;
}

export interface BulkOperationResult {
    status: "in_progress" | "completed" | "failed";
}

export interface BulkObjectDeleteResult extends BulkOperationResult {
    /** Number of documents deleted (including revisions) */
    deleted: number;
    /** IDs that were not found or user had no permission to delete */
    failed: string[];
}
