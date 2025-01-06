import { DSLActivitySpec, DSLWorkflowSpec, DSLWorkflowStep } from "@vertesia/common";
import { Vars, splitPath } from "./vars.js";

export function validateWorkflow(workflow: DSLWorkflowSpec, vars: string[] = []) {
    const errors: string[] = [];
    const workflowVars = new Set(vars);
    workflowVars.add("objectId");
    workflowVars.add("objectIds");
    if (workflow.vars) {
        for (const v of Object.keys(workflow.vars)) {
            workflowVars.add(v);
        }
    }
    if (!workflow.name) {
        errors.push("Workflow 'name' property is required");
    }
    if (workflow.steps && workflow.activities) {
        errors.push("You must use either 'steps' or 'activities'. You cannot use both. Prefer using steps.");
        return errors;
    }
    if (!workflow.steps && !workflow.activities) {
        errors.push("The workflow requires one of 'steps' or 'activities' properties. Neither is present.");
        return errors;
    }
    const stepsPropName = workflow.steps ? "steps" : "activities";
    const steps = workflow.steps || workflow.activities;
    if (!steps || !Array.isArray(steps)) {
        errors.push(`Workflow '${stepsPropName}' property is required`);
        return errors;
    }
    if (!steps || !Array.isArray(steps)) {
        errors.push(`Workflow '${stepsPropName}' should be an array`);
        return errors;
    }
    if (!steps.length) {
        errors.push("Workflow should have at least one step or activity");
    }

    const activities: DSLActivitySpec[] = stepsPropName === "steps" ? (steps as DSLWorkflowStep[]).filter(s => s.type === "activity") : steps;
    for (const activity of activities) {
        const activityErrors = validateActivity(activity, workflowVars);
        if (activityErrors.length > 0) {
            for (const err of activityErrors) {
                errors.push(`Activity "${activity.name}": ${err}`);
            }
        }
        if (activity.output) {
            workflowVars.add(activity.output);
        }
    }

    return errors;
}

export function validateActivity(activity: DSLActivitySpec, workflowVars: Set<string>): string[] {
    const errors: string[] = [];
    if (!activity.name) {
        errors.push("Activity name is required");
    }
    const importedVars = activity.import;
    const localVars: Record<string, boolean> = {};
    if (importedVars && importedVars.length > 0) {
        for (const entry of importedVars) {
            if (typeof entry === 'string') {
                pushLocalVar(entry, localVars, errors);
                if (!workflowVars.has(entry)) {
                    errors.push(`Unknown workflow variable "${entry}" in import declaration`);
                }
            } else {
                for (const key of Object.keys(entry)) {
                    pushLocalVar(key, localVars, errors);
                    const wfExpr = entry[key];
                    const wfVar = splitPath(wfExpr)[0];
                    if (!workflowVars.has(wfVar)) {
                        errors.push(`Unknown workflow variable "${wfExpr}" in import declaration`);
                    }
                }
            }
        }
    }

    // collect fetch vars and check expressions in fetch declarations
    const fetch = activity.fetch;
    if (fetch) {
        const keys = Object.keys(fetch);
        for (const key of keys) {
            const query = fetch[key].query;
            // check expressions in query
            validateExpressions(query, localVars, errors);
        }
        for (const key of keys) {
            pushLocalVar(key, localVars, errors);
        }
    }
    // check expressions in activity params
    if (activity.params) {
        validateExpressions(activity.params, localVars, errors, true);
    }
    return errors;
}


function validateExpressions(target: Record<string, any>, localVars: Record<string, boolean>, errors: string[], checkSelfReference = false) {
    const vars = new Vars(localVars);
    const refs = vars.getUnknownReferences(target);
    for (const ref of refs) {
        errors.push(`Unknown variable "${ref.name}" in expression "${ref.expression}"`)
    }
    if (checkSelfReference) {
        // check for self references like `"object_type": "${object_type}"`.
        for (const key of Object.keys(target)) {
            const value = target[key];
            if (typeof value === 'string' && value.includes("${" + key + "}")) {
                errors.push(`Self referencing parameter "${key}" in expression "${value}"`);
            }
        }
    }
}

function pushLocalVar(v: string, localVars: Record<string, boolean>, errors: string[]) {
    if (localVars[v] === true) {
        errors.push(`Duplicate variable "${v}"`);
    }
    localVars[v] = true;
}
