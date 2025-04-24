import { ActivityInterfaceFor, ActivityOptions, executeChild, log, proxyActivities, startChild, UntypedActivities } from "@temporalio/workflow";
import {
    DSLActivityExecutionPayload,
    DSLActivityOptions,
    DSLActivitySpec,
    DSLChildWorkflowStep,
    DSLWorkflowExecutionPayload,
    WorkflowExecutionPayload
} from "@vertesia/common";
import ms, { StringValue } from 'ms';
import { ActivityParamNotFound, NoDocumentFound, WorkflowParamNotFound } from "../errors.js";
import { Vars } from "./vars.js";

interface BaseActivityPayload extends WorkflowExecutionPayload {
    workflow_name: string;
    debug_mode?: boolean;
}

function dslActivityPayload<ParamsT extends Record<string, any>>(basePayload: BaseActivityPayload, activity: DSLActivitySpec, params: ParamsT) {
    return {
        ...basePayload,
        activity,
        params: params || {},
    } as DSLActivityExecutionPayload<ParamsT>
}

export async function dslWorkflow(payload: DSLWorkflowExecutionPayload) {

    const definition = payload.workflow;
    if (!definition) {
        throw new WorkflowParamNotFound("workflow");
    }
    // the base payload wiull be used to create the activities payload
    const basePayload: BaseActivityPayload = {
        ...payload,
        workflow_name: definition.name,
        debug_mode: !!definition.debug_mode,
    }
    delete (basePayload as any).workflow;

    const defaultOptions: ActivityOptions = {
        ...convertDSLActivityOptions(definition.options),
        startToCloseTimeout: "5 minute",
        retry: {
            initialInterval: '10s',
            backoffCoefficient: 2,
            maximumAttempts: 10,
            maximumInterval: 100 * 30 * 1000, //ms
            nonRetryableErrorTypes: [
                NoDocumentFound.name,
                ActivityParamNotFound.name,
                WorkflowParamNotFound.name,
            ],
        },
    };
    log.debug("Global activity options", {
        activityOptions: defaultOptions,
    });
    const defaultProxy = proxyActivities(defaultOptions);
    log.debug("Default activity proxy is ready");
    // merge default vars with the payload vars and add objectIds and obejctId
    const vars = new Vars({
        ...definition.vars,
        ...payload.vars,
        objectIds: payload.objectIds || [],
        objectId: payload.objectIds ? payload.objectIds[0] : undefined
    });

    log.info("Executing workflow", { payload });

    if (definition.steps) {
        for (const step of definition.steps) {
            const stepType = step.type;
            if (stepType === 'workflow') {
                const childWorkflowStep = step as DSLChildWorkflowStep;
                if (childWorkflowStep.async) {
                    await startChildWorkflow(childWorkflowStep, payload, vars, basePayload.debug_mode);
                } else {
                    await executeChildWorkflow(childWorkflowStep, payload, vars, basePayload.debug_mode);
                }
            } else { // activity
                await runActivity(step as DSLActivitySpec, basePayload, vars, defaultProxy, defaultOptions);
            }
        }
    } else if (definition.activities) { // legacy support
        for (const activity of definition.activities) {
            await runActivity(activity, basePayload, vars, defaultProxy, defaultOptions);
        }
    } else {
        throw new Error("No steps or activities found in the workflow definition");
    }
    return vars.getValue(definition.result || 'result');
}

async function startChildWorkflow(step: DSLChildWorkflowStep, payload: DSLWorkflowExecutionPayload, vars: Vars, debug_mode?: boolean) {
    const resolvedVars = vars.resolve();
    if (step.vars) {
        // copy user vars (from step definition) to the resolved vars
        Object.assign(resolvedVars, step.vars);
    }
    if (debug_mode) {
        log.debug(`Workflow vars before starting child workflow ${step.name}`, { vars: resolvedVars });
    }
    //@ts-ignore
    const handle = await startChild(step.name, {
        ...step.options,
        args: [{
            ...payload,
            workflow: step.spec,
            vars: resolvedVars
        }],
        searchAttributes: {
            AccountId: [payload.account_id],
            ProjectId: [payload.project_id],
        },
    });
    if (step.output) {
        vars.setValue(step.output, handle.workflowId);
    }
}

async function executeChildWorkflow(step: DSLChildWorkflowStep, payload: DSLWorkflowExecutionPayload, vars: Vars, debug_mode?: boolean) {
    const resolvedVars = vars.resolve();
    if (step.vars) {
        // copy user vars (from step definition) to the resolved vars
        Object.assign(resolvedVars, step.vars);
    }
    if (debug_mode) {
        log.debug(`Workflow vars before excuting child workflow ${step.name}`, { vars: resolvedVars });
    }
    //@ts-ignore
    const result = await executeChild(step.name, {
        ...step.options,
        args: [{
            ...payload,
            workflow: step.spec,
            vars: resolvedVars,
        }],
        searchAttributes: {
            AccountId: [payload.account_id],
            ProjectId: [payload.project_id],
        },
    });

    if (step.output) {
        vars.setValue(step.output, result);
        if (debug_mode) {
            log.debug(`Workflow vars after executing child workflow ${step.name}`, { vars: vars.resolve() });
        }
    } else if (debug_mode) {
        log.debug(`Workflow vars after executing child workflow ${step.name}`, { vars: resolvedVars });
    }
}

async function runActivity(activity: DSLActivitySpec, basePayload: BaseActivityPayload, vars: Vars, defaultProxy: ActivityInterfaceFor<UntypedActivities>, defaultOptions: ActivityOptions) {
    if (basePayload.debug_mode) {
        log.debug(`Workflow vars before executing activity ${activity.name}`, { vars: vars.resolve() });
    }
    if (activity.condition && !vars.match(activity.condition)) {
        log.info("Activity skiped: condition not satisfied", activity.condition);
        return;
    }
    const importParams = vars.createImportVars(activity.import);
    const executionPayload = dslActivityPayload(basePayload, activity, importParams);
    log.info("Executing activity: " + activity.name, { payload: executionPayload });

    let proxy = defaultProxy;
    if (activity.options) {
        const options = computeActivityOptions(activity.options, defaultOptions);
        log.debug("Use custom activity options", {
            activityName: activity.name,
            activityOptions: options,
        });
        proxy = proxyActivities(options)
    } else {
        log.debug("Use default activity options", {
            activityName: activity.name,
            activityOptions: defaultOptions,
        });
    }

    const fn = proxy[activity.name];
    if (activity.parallel) {
        //TODO execute in parallel
        log.info("Parallel execution not yet implemented");
    } else {
        log.info("Executing activity: " + activity.name, { importParams });
        const result = await fn(executionPayload);
        if (activity.output) {
            vars.setValue(activity.output, result);
        }
    }
    if (basePayload.debug_mode) {
        log.debug(`Workflow vars after executing activity ${activity.name}`, { vars: vars.resolve() });
    }
}

export function computeActivityOptions(customOptions: DSLActivityOptions, defaultOptions: ActivityOptions): ActivityOptions {
    const options = convertDSLActivityOptions(customOptions);
    return {
        ...defaultOptions,
        ...options,
        retry: {
            ...defaultOptions.retry,
            ...options.retry,
        }
    }
}

function convertDSLActivityOptions(options?: DSLActivityOptions): ActivityOptions {
    if (!options) {
        return {};
    }
    let result: ActivityOptions = {};
    if (options.startToCloseTimeout) {
        result.startToCloseTimeout = ms(options.startToCloseTimeout as StringValue);
    }
    if (options.scheduleToCloseTimeout) {
        result.scheduleToCloseTimeout = ms(options.scheduleToCloseTimeout as StringValue);
    }
    if (options.scheduleToStartTimeout) {
        result.scheduleToStartTimeout = ms(options.scheduleToStartTimeout as StringValue);
    }
    if (options.retry) {
        result.retry = {};
        if (options.retry.initialInterval) {
            result.retry.initialInterval = ms(options.retry.initialInterval as StringValue);
        }
        if (options.retry.maximumInterval) {
            result.retry.maximumInterval = ms(options.retry.maximumInterval as StringValue);
        }
        if (options.retry.maximumAttempts) {
            result.retry.maximumAttempts = options.retry.maximumAttempts;
        }
        if (options.retry.backoffCoefficient) {
            result.retry.backoffCoefficient = options.retry.backoffCoefficient;
        }
        if (options.retry.nonRetryableErrorTypes) {
            result.retry.nonRetryableErrorTypes = options.retry.nonRetryableErrorTypes;
        }
    }
    return result;
}
