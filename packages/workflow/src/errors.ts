import { ApplicationFailure } from "@temporalio/workflow";
import { DSLActivitySpec, DSLWorkflowSpec } from "@vertesia/common";

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
            "DocumentNotFound",
            true, // non-retryable
        )
    }
}

export class ActivityParamNotFound extends Error {
    constructor(
        public paramName: string,
        public activity: DSLActivitySpec,
    ) {
        super(`Required parameter ${paramName} not found in activity ${activity.name}`);
        this.name = "ActivityParamNotFound";
    }
}

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

export class WorkflowParamNotFound extends Error {
    constructor(
        public paramName: string,
        public workflow?: DSLWorkflowSpec,
    ) {
        super(`Required parameter ${paramName} not found in workflow ${workflow?.name}`);
        this.name = "WorkflowParamNotFound";
    }
}

export const WF_NON_RETRYABLE_ERRORS = [
    "NoDocumentFound",
    "DocumentNotFound",
    "ActivityParamNotFound",
    "WorkflowParamNotFound",
];
