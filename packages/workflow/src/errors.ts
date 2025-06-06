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

export const WF_NON_RETRYABLE_ERRORS = [
    "DocumentNotFoundError",
    "ActivityParamInvalidError",
    "ActivityParamNotFoundError",
    "WorkflowParamNotFoundError",
];
