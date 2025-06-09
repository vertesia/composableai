import { ApplicationFailure } from "@temporalio/workflow";
import { DSLActivitySpec, DSLWorkflowSpec } from "@vertesia/common";

/**
 * @deprecated Use {@link DocumentNotFoundError} instead.
 */
export class NoDocumentFound extends Error {
    constructor(
        message: string,
        public ids?: string[],
    ) {
        super(message);
        this.name = "NoDocumentFound";
        this.ids = ids;
    }
}

export class DocumentNotFoundError extends ApplicationFailure {
    constructor(message: string, public ids?: string[]) {
        super(
            message,
            "DocumentNotFoundError",
            true, // non-retryable
        )
    }
}

/**
 * @deprecated Use {@link ActivityParamNotFoundError} instead.
 */
export class ActivityParamNotFound extends Error {
    constructor(
        public paramName: string,
        public activity: DSLActivitySpec,
    ) {
        super(`Required parameter ${paramName} not found in activity ${activity.name}`);
        this.name = "ActivityParamNotFound";
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

/**
 * @deprecated Use {@link ActivityParamInvalidError} instead.
 */
export class ActivityParamInvalid extends Error {
    constructor(
        public paramName: string,
        public activity: DSLActivitySpec,
        reason?: string,
    ) {
        super(`${paramName} in activity ${activity.name} is invalid${reason ? ` ${reason}` : ""}`);
        this.name = "ActivityParamInvalid";
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

/**
 * @deprecated Use {@link WorkflowParamNotFoundError} instead.
 */
export class WorkflowParamNotFound extends Error {
    constructor(
        public paramName: string,
        public workflow?: DSLWorkflowSpec,
    ) {
        super(`Required parameter ${paramName} not found in workflow ${workflow?.name}`);
        this.name = "WorkflowParamNotFound";
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

export const WF_NON_RETRYABLE_ERRORS = [
    "NoDocumentFound",
    "DocumentNotFoundError",
    "ActivityParamInvalid",
    "ActivityParamInvalidError",
    "ActivityParamNotFound",
    "ActivityParamNotFoundError",
    "WorkflowParamNotFound",
    "WorkflowParamNotFoundError",
];
