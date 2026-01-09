import { ApplicationFailure } from "@temporalio/workflow";
import { DSLActivitySpec, DSLWorkflowSpec } from "@vertesia/common";

export class DocumentNotFoundError extends ApplicationFailure {
    constructor(message: string, public ids?: string[]) {
        super(
            message,
            "DocumentNotFoundError",
            true, // non-retryable
        )
    }
}

export class ActivityParamNotFoundError extends ApplicationFailure {
    constructor(
        public paramName: string,
        public activity: DSLActivitySpec,
    ) {
        super(
            `Required parameter ${paramName} not found in activity ${activity.name}`,
            "ActivityParamNotFoundError",
            true, // non-retryable
        );
    }
}

export class ActivityParamInvalidError extends ApplicationFailure {
    constructor(
        public paramName: string,
        public activity: DSLActivitySpec,
        reason?: string,
    ) {
        super(
            `${paramName} in activity ${activity.name} is invalid${reason ? ` ${reason}` : ""}`,
            "ActivityParamInvalidError",
            true, // non-retryable
        );
    }
}

export class WorkflowParamNotFoundError extends ApplicationFailure {
    constructor(
        public paramName: string,
        public workflow?: DSLWorkflowSpec,
    ) {
        super(
            `Required parameter ${paramName} not found in workflow ${workflow?.name}`,
            "WorkflowParamNotFoundError",
            true, // non-retryable
        );
    }
}

export class ResourceExhaustedError extends ApplicationFailure {
    constructor(
        public statusCode: number = 429,
        message?: string,
    ) {
        super(
            message || "Resource exhausted - rate limit exceeded",
            "ResourceExhaustedError",
            true, // non-retryable
        );
    }
}

export class InvalidContentTypeError extends ApplicationFailure {
    constructor(
        public objectId: string,
        public expectedType: string,
        public actualType: string,
    ) {
        super(
            `Document ${objectId} has invalid content type. Expected ${expectedType}, got ${actualType}`,
            "InvalidContentTypeError",
            true, // non-retryable
        );
    }
}

export class TokenExpiredError extends ApplicationFailure {
    constructor(
        public statusCode: number,
        message?: string,
    ) {
        super(
            message || "Token expired: Authentication required",
            "TokenExpiredError",
            true, // non-retryable
        );
    }
}

export const WF_NON_RETRYABLE_ERRORS = [
    "DocumentNotFoundError",
    "ActivityParamInvalidError",
    "ActivityParamNotFoundError",
    "WorkflowParamNotFoundError",
    "InvalidContentTypeError",
    "TokenExpiredError",
];
