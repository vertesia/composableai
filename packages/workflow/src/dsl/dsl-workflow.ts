import {
    ActivityInterfaceFor,
    ActivityOptions,
    CancellationScope,
    executeChild,
    isCancellation,
    log,
    patched,
    proxyActivities,
    sleep,
    startChild,
    UntypedActivities,
} from "@temporalio/workflow";
import {
    DSLActivityExecutionPayload,
    DSLActivityOptions,
    DSLActivitySpec,
    DSLChildWorkflowStep,
    DSLWorkflowExecutionPayload,
    DSLWorkflowSpec,
    getDocumentIds,
    getTenantId,
    WorkflowExecutionPayload,
    WorkflowInputFile
} from "@vertesia/common";
import ms, { StringValue } from 'ms';
import { HandleDslErrorParams } from "../activities/handleError.js";
import * as activities from "../activities/index.js";
import { RateLimitParams } from "../activities/rateLimiter.js";
import { WF_NON_RETRYABLE_ERRORS, WorkflowParamNotFoundError } from "../errors.js";
import { Vars } from "./vars.js";

/** Prefix identifying a remote activity name in DSL workflow steps */
const REMOTE_ACTIVITY_PREFIX = "app:";

/**
 * Minimal type for remote activity info used in the workflow.
 * Must stay compatible with RemoteActivityInfo from resolveRemoteActivities.
 * Defined inline to avoid importing from activity files in workflow code.
 */
interface RemoteActivityEntry {
    url: string;
    activity_name: string;
    app_install_id: string;
    app_name: string;
    app_settings?: Record<string, any>;
}
type RemoteActivityMap = Record<string, RemoteActivityEntry>;

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
        throw new WorkflowParamNotFoundError("workflow");
    }

    // Normalize input: convert legacy objectIds format to new input format
    if (!payload.input && payload.objectIds) {
        payload.input = {
            inputType: 'objectIds',
            objectIds: payload.objectIds
        };
    }

    // Validate that workflow has input
    if (!payload.input && !payload.objectIds) {
        throw new WorkflowParamNotFoundError(
            "input",
            definition
        );
    }

    // the base payload will be used to create the activities payload
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
            nonRetryableErrorTypes: WF_NON_RETRYABLE_ERRORS,
        },
    };
    log.debug("Global activity options", {
        activityOptions: defaultOptions,
    });
    const defaultProxy = proxyActivities(defaultOptions);
    log.debug("Default activity proxy is ready");

    // Merge default vars with the payload vars and add input variables
    const inputType = payload.input?.inputType || 'objectIds';

    // Extract objectIds and files based on input type
    let objectIds: string[] = [];
    let files: WorkflowInputFile[] = [];

    if (payload.input) {
        if (payload.input.inputType === 'objectIds') {
            objectIds = payload.input.objectIds;
        } else if (payload.input.inputType === 'files') {
            files = payload.input.files;
        }
    }

    const vars = new Vars({
        ...definition.vars,
        ...payload.vars,
        // Add input type variables
        inputType,
        // Add objectIds variables (for objectIds input or backward compatibility)
        objectIds,
        objectId: objectIds[0],
        // Add files variables (for files input)
        files,
        file: files[0],
    });

    log.info("Executing workflow", { payload });

    // Resolve remote activities from installed apps only if the workflow uses prefixed activity names
    let remoteActivities: RemoteActivityMap = {};
    if (patched('dsl-remote-activities') && hasRemoteActivitySteps(definition)) {
        try {
            const resolvePayload = dslActivityPayload(
                basePayload, { name: 'resolveRemoteActivities' } as DSLActivitySpec, {},
            );
            remoteActivities = await defaultProxy.resolveRemoteActivities(resolvePayload) as RemoteActivityMap;
            if (Object.keys(remoteActivities).length > 0) {
                log.info("Resolved remote activities", {
                    count: Object.keys(remoteActivities).length,
                    names: Object.keys(remoteActivities),
                });
            }
        } catch (e: any) {
            log.warn("Failed to resolve remote activities, continuing without them", { error: e.message });
        }
    }

    // TODO(mhuang): remove patch when all workflows are migrated to v2
    //   It avoids breaking the ongoing workflow execution running in v1 and also allows us to
    //   deploy the new error handler in production.
    //   See https://docs.temporal.io/develop/typescript/versioning
    if (patched('dsl-workflow-error-handling')) {
        // v2: new version with error handler
        try {
            await executeSteps(definition, payload, basePayload, vars, defaultProxy, defaultOptions, remoteActivities);
        } catch (e) {
            await handleError(e, basePayload, defaultOptions);
        }
    } else {
        // v1: old version without error handler, deprecated since v0.52.0
        await executeSteps(definition, payload, basePayload, vars, defaultProxy, defaultOptions, remoteActivities);
    }

    return vars.getValue(definition.result || 'result');
}

async function executeSteps(definition: DSLWorkflowSpec, payload: DSLWorkflowExecutionPayload, basePayload: BaseActivityPayload, vars: Vars, defaultProxy: ActivityInterfaceFor<UntypedActivities>, defaultOptions: ActivityOptions, remoteActivities: RemoteActivityMap = {}) {
    if (definition.steps) {
        for (const step of definition.steps) {
            const stepType = step.type;
            if (stepType === 'workflow') {
                const childWorkflowStep = step as DSLChildWorkflowStep;
                if (childWorkflowStep.async) {
                    await startChildWorkflow(childWorkflowStep, payload, vars, basePayload.debug_mode, defaultProxy, basePayload);
                } else {
                    await executeChildWorkflow(childWorkflowStep, payload, vars, basePayload.debug_mode, defaultProxy, basePayload);
                }
            } else { // activity
                await runActivity(step as DSLActivitySpec, basePayload, vars, defaultProxy, defaultOptions, remoteActivities);
            }
        }
    } else if (definition.activities) { // legacy support
        for (const activity of definition.activities) {
            await runActivity(activity, basePayload, vars, defaultProxy, defaultOptions, remoteActivities);
        }
    } else {
        throw new Error("No steps or activities found in the workflow definition");
    }
}

/**
 * Check whether any activity step in the workflow definition uses a remote activity name
 * (starts with `app:`), indicating it may reference a remote activity.
 * Avoids resolving remote activities when not needed.
 */
function hasRemoteActivitySteps(definition: DSLWorkflowSpec): boolean {
    const steps = definition.steps || definition.activities || [];
    return steps.some(step => 'name' in step && step.name?.startsWith(REMOTE_ACTIVITY_PREFIX));
}

async function handleError(originalError: any, basePayload: BaseActivityPayload, defaultOptions: ActivityOptions) {
    const { handleDslError } = proxyActivities<typeof activities>(defaultOptions);

    const payload = dslActivityPayload(
        basePayload,
        {
            name: "handleDslError",
            params: { errorMessage: originalError.message },
        } as DSLActivitySpec,
        { errorMessage: originalError.message } satisfies HandleDslErrorParams,
    )

    if (isCancellation(originalError)) {
        log.warn(`Workflow execution cancelled, executing error handler to update document status`, { error: originalError });
        // Cleanup logic must be in a nonCancellable scope
        // If we'd run cleanup outside of a nonCancellable scope it would've been cancelled
        // before being started because the Workflow's root scope is cancelled.
        // see https://docs.temporal.io/develop/typescript/cancellation
        await CancellationScope.nonCancellable(() => handleDslError(payload));
    } else {
        log.warn(`Workflow execution failed, executing error handler to update document status`, { error: originalError });
        await handleDslError(payload);
    }
    throw originalError;
}

async function startChildWorkflow(step: DSLChildWorkflowStep, payload: DSLWorkflowExecutionPayload, vars: Vars, debug_mode?: boolean, proxy?: ActivityInterfaceFor<UntypedActivities>, basePayload?: BaseActivityPayload) {
    if (step.condition && !vars.match(step.condition)) {
        log.info("Child workflow skipped: condition not satisfied", { workflow: step.name, condition: step.condition });
        return;
    }
    if (step.name.startsWith('dsl:') && !step.spec && proxy && basePayload) {
        const workflowName = step.name.slice(4);
        const specPayload = dslActivityPayload(basePayload, { name: 'loadChildWorkflowSpec' } as DSLActivitySpec, { workflowName });
        const spec = await proxy.loadChildWorkflowSpec(specPayload) as DSLWorkflowSpec;
        const humanName = spec.name.replace(/([A-Z])/g, ' $1').trim();
        const objectIds = getDocumentIds(payload);
        const workflowId = objectIds.length > 0 ? `${humanName}:${objectIds[0]}` : humanName;
        step = { ...step, name: 'dslWorkflow', spec, options: { ...step.options, workflowId } };
    }
    const resolvedVars = vars.resolve();
    if (step.vars) {
        // copy user vars (from step definition) to the resolved vars, resolving any expressions
        const resolvedStepVars = vars.resolveParams(step.vars);
        Object.assign(resolvedVars, resolvedStepVars);
    }
    if (debug_mode) {
        log.debug(`Workflow vars before starting child workflow ${step.name}`, { vars: resolvedVars });
    }

    const handle = await startChild(step.name, {
        ...step.options,
        args: [{
            ...payload,
            workflow: step.spec,
            vars: resolvedVars,
        }],
        memo: {
            InitiatedBy: payload.initiated_by,
        },
        searchAttributes: {
            AccountId: [payload.account_id],
            DocumentId: getDocumentIds(payload),
            ProjectId: [payload.project_id],
            TenantId: [getTenantId(payload.account_id, payload.project_id)],
            InitiatedBy: payload.initiated_by ? [payload.initiated_by] : [],
        },
    });
    if (step.output) {
        vars.setValue(step.output, handle.workflowId);
    }
}

async function executeChildWorkflow(step: DSLChildWorkflowStep, payload: DSLWorkflowExecutionPayload, vars: Vars, debug_mode?: boolean, proxy?: ActivityInterfaceFor<UntypedActivities>, basePayload?: BaseActivityPayload) {
    if (step.condition && !vars.match(step.condition)) {
        log.info("Child workflow skipped: condition not satisfied", { workflow: step.name, condition: step.condition });
        return;
    }
    if (step.name.startsWith('dsl:') && !step.spec && proxy && basePayload) {
        const workflowName = step.name.slice(4);
        const specPayload = dslActivityPayload(basePayload, { name: 'loadChildWorkflowSpec' } as DSLActivitySpec, { workflowName });
        const spec = await proxy.loadChildWorkflowSpec(specPayload) as DSLWorkflowSpec;
        const humanName = spec.name.replace(/([A-Z])/g, ' $1').trim();
        const objectIds = getDocumentIds(payload);
        const workflowId = objectIds.length > 0 ? `${humanName}:${objectIds[0]}` : humanName;
        step = { ...step, name: 'dslWorkflow', spec, options: { ...step.options, workflowId } };
    }
    const resolvedVars = vars.resolve();
    if (step.vars) {
        // copy user vars (from step definition) to the resolved vars, resolving any expressions
        const resolvedStepVars = vars.resolveParams(step.vars);
        Object.assign(resolvedVars, resolvedStepVars);
    }
    if (debug_mode) {
        log.debug(`Workflow vars before executing child workflow ${step.name}`, { vars: resolvedVars });
    }

    const result = await executeChild(step.name, {
        ...step.options,
        args: [{
            ...payload,
            workflow: step.spec,
            vars: resolvedVars,
        }],
        memo: {
            InitiatedBy: payload.initiated_by,
        },
        searchAttributes: {
            AccountId: [payload.account_id],
            DocumentId: getDocumentIds(payload),
            ProjectId: [payload.project_id],
            TenantId: [getTenantId(payload.account_id, payload.project_id)],
            InitiatedBy: payload.initiated_by ? [payload.initiated_by] : [],
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

function buildRateLimitParams(activity: DSLActivitySpec, executionPayload: DSLActivityExecutionPayload<any>): RateLimitParams {
    // resolve payload params
    const vars = new Vars({
        ...executionPayload.params, // imported params (doesn't contain expressions)
        ...executionPayload.activity.params, // activity params (may contain expressions)
    });
    const params = vars.resolve();

    let interactionId: string;

    switch (activity.name) {
        case "executeInteraction":
            interactionId = params.interactionName;
            break;

        case "generateDocumentProperties":
            interactionId = params.interactionName || "sys:ExtractInformation";
            break;

        case "identifyTextSections":
            interactionId = params.interactionName || "sys:IdentifyTextSections";
            break;

        case "generateOrAssignContentType":
            interactionId = params.interactionNames?.selectDocumentType || "sys:SelectDocumentType";
            break;

        case "chunkDocument":
            interactionId = params.interactionName || "sys:ChunkDocument";
            break;

        default:
            // For any other rate-limited activities, try to extract what we can
            interactionId = params.interactionName;
            break;
    }

    if (!interactionId) {
        throw new Error(`No interaction ID could be determined for activity ${activity.name}`);
    }

    return {
        interactionIdOrEndpoint: interactionId,
        environmentId: params.environment,
        modelId: params.model,
    };
}

async function runActivity(activity: DSLActivitySpec, basePayload: BaseActivityPayload, vars: Vars, defaultProxy: ActivityInterfaceFor<UntypedActivities>, defaultOptions: ActivityOptions, remoteActivities: RemoteActivityMap = {}) {
    if (basePayload.debug_mode) {
        log.debug(`Workflow vars before executing activity ${activity.name}`, { vars: vars.resolve() });
    }
    if (activity.condition && !vars.match(activity.condition)) {
        log.info("Activity skipped: condition not satisfied", activity.condition);
        return;
    }

    const importParams = vars.createImportVars(activity.import);
    const executionPayload = dslActivityPayload(basePayload, activity, importParams);
    log.debug("Executing activity: " + activity.name, { payload: executionPayload });

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

    if (patched('system-activity-taskqueue')) {
        // hack: do nothing, remove later
        // https://github.com/vertesia/composableai/pull/544/files
    }

    // Check if this is a remote activity (name starts with "app:")
    if (activity.name.startsWith(REMOTE_ACTIVITY_PREFIX)) {
        if (!remoteActivities[activity.name]) {
            throw new Error(
                `Remote activity "${activity.name}" not found. ` +
                `Available: ${Object.keys(remoteActivities).join(', ') || '(none resolved)'}`
            );
        }
        const remote = remoteActivities[activity.name];
        log.info("Executing remote activity", {
            activityName: activity.name,
            remoteName: remote.activity_name,
            app: remote.app_name,
            url: remote.url,
        });
        const remotePayload = dslActivityPayload(basePayload, activity, {
            url: remote.url,
            activity_name: remote.activity_name,
            // Merge imported vars with static activity params, then resolve expressions
            // (same merge pattern used by local activities — see buildRateLimitParams)
            params: new Vars({ ...importParams, ...activity.params }).resolve(),
            app_install_id: remote.app_install_id,
            app_name: remote.app_name,
            app_settings: remote.app_settings,
        });
        const result = await proxy.executeRemoteActivity(remotePayload);
        if (activity.output) {
            vars.setValue(activity.output, result);
        }
        if (basePayload.debug_mode) {
            log.debug(`Workflow vars after executing remote activity ${activity.name}`, { vars: vars.resolve() });
        }
        return;
    }

    // call rate limiter depending on the activity type
    const rateLimitedActivities = [
        "chunkDocument",
        "executeInteraction",
        "generateDocumentProperties",
        "generateOrAssignContentType",
        "identifyTextSections",
    ];

    if (activity.name && rateLimitedActivities.includes(activity.name)) {
        log.debug(`Applying rate limit for activity ${activity.name}`);
        // Apply rate limiting logic here
         // Check rate limit first - loop until no delay
        const rateLimitParams = buildRateLimitParams(activity, executionPayload);

        const rateLimitPayload = dslActivityPayload(basePayload, activity, rateLimitParams);
        let rateLimitResult = await proxy.checkRateLimit(rateLimitPayload);

        while (rateLimitResult.delayMs > 0) {
            log.debug(`Rate limit delay applied: ${rateLimitResult.delayMs}ms`);
            await sleep(rateLimitResult.delayMs);

            // Check again after sleeping
            rateLimitResult = await proxy.checkRateLimit(rateLimitPayload);
        }
    }

    const fn = proxy[activity.name];
    if (activity.parallel) {
        //TODO execute in parallel
        log.info("Parallel execution not yet implemented");
    } else {
        log.debug("Executing activity: " + activity.name, { importParams });
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
