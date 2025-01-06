import { DSLActivitySpec, DSLWorkflowSpec } from "@vertesia/common";


export class NoDocumentFound extends Error {
    constructor(message: string, public ids?: string[]) {
        super(message);
        this.name = "NoDocumentFound";
        this.ids = ids
    }
}

export class ActivityParamNotFound extends Error {
    constructor(public paramName: string, public activity: DSLActivitySpec) {
        super(`Required parameter ${paramName} not found in activity ${activity.name}`);
        this.name = "ActivityParamNotFound";
    }
}

export class WorkflowParamNotFound extends Error {
    constructor(public paramName: string, public workflow?: DSLWorkflowSpec) {
        super(`Required parameter ${paramName} not found in workflow ${workflow?.name}`);
        this.name = "WorkflowParamNotFound";
    }
}