import { AsyncExecutionResult, VertesiaClient } from "@vertesia/client";
import { AgentSearchScope, ConversationVisibility, ExecutionEnvironmentRef, InCodeInteraction, JSONSchema, mergeInCodePromptSchemas, supportsToolUse, UserChannel, WorkflowInteractionVars } from "@vertesia/common";
import { JSONObject } from "@vertesia/json";
import { useUserSession } from "@vertesia/ui/session";
import Ajv, { ValidateFunction } from "ajv";
import React, { createContext, useContext, useEffect, useState } from "react";

export type WorkflowMode = 'start' | 'schedule';

export interface ScheduledWorkflowConfig {
    name: string;
    description?: string;
    cron_expression: string;
    timezone: string;
}

export class PayloadBuilder {
    _interactive: boolean = true;
    _debug_mode: boolean = false;
    _checkpoint_tokens: number | undefined;
    _visibility: ConversationVisibility | undefined;
    _user_channels: UserChannel[] | undefined;
    _collection: string | undefined;
    _start: boolean = false;
    _preserveRunValues: boolean = false;
    _interaction: InCodeInteraction | undefined;
    _environment: ExecutionEnvironmentRef | undefined;
    _model: string = '';
    _tool_names: string[] = [];
    _data: JSONObject | undefined;
    _mode: WorkflowMode = 'start';
    _scheduledWorkflowConfig: ScheduledWorkflowConfig | undefined;

    private _interactionParamsSchema?: JSONSchema | null;
    private _inputValidator?: {
        validate: ValidateFunction;
        schema: JSONSchema;
    };

    constructor(public vertesia: VertesiaClient, public updateState: (data: PayloadBuilder) => void) {
    }

    onStateChanged() {
        const newInstance = this.clone();
        this.updateState(newInstance);
    }

    clone() {
        const builder = new PayloadBuilder(this.vertesia, this.updateState);
        builder._interactionParamsSchema = this._interactionParamsSchema;
        builder._interaction = this._interaction;
        builder._data = this._data;
        builder._environment = this._environment;
        builder._model = this._model;
        builder._tool_names = [...this._tool_names];
        builder._interactive = this._interactive;
        builder._debug_mode = this._debug_mode;
        builder._checkpoint_tokens = this._checkpoint_tokens;
        builder._visibility = this._visibility;
        builder._user_channels = this._user_channels ? [...this._user_channels] : undefined;
        builder._inputValidator = this._inputValidator;
        builder._start = this._start;
        builder._collection = this._collection;
        builder._preserveRunValues = this._preserveRunValues;
        builder._mode = this._mode;
        builder._scheduledWorkflowConfig = this._scheduledWorkflowConfig;
        return builder;
    }

    set mode(mode: 'start' | 'schedule') {
        if (mode !== this._mode) {
            this._mode = mode;
            this.onStateChanged();
        }
    }

    get mode() {
        return this._mode;
    }

    set scheduledWorkflowConfig(config: ScheduledWorkflowConfig | undefined) {
        this._scheduledWorkflowConfig = config;
        this.onStateChanged();
    }

    get scheduledWorkflowConfig() {
        return this._scheduledWorkflowConfig;
    }

    get interactive() {
        return this._interactive;
    }

    set interactive(interactive: boolean) {
        if (interactive !== this._interactive) {
            this._interactive = interactive;
            this.onStateChanged();
        }
    }

    get debug_mode() {
        return this._debug_mode;
    }

    set debug_mode(debug_mode: boolean) {
        if (debug_mode !== this._debug_mode) {
            this._debug_mode = debug_mode;
            this.onStateChanged();
        }
    }

    get checkpoint_tokens(): number | undefined {
        return this._checkpoint_tokens;
    }

    set checkpoint_tokens(value: number | undefined) {
        if (value !== this._checkpoint_tokens) {
            this._checkpoint_tokens = value;
            this.onStateChanged();
        }
    }

    get visibility(): ConversationVisibility | undefined {
        return this._visibility;
    }

    set visibility(value: ConversationVisibility | undefined) {
        if (value !== this._visibility) {
            this._visibility = value;
            this.onStateChanged();
        }
    }

    get user_channels(): UserChannel[] | undefined {
        return this._user_channels;
    }

    set user_channels(user_channels: UserChannel[] | undefined) {
        this._user_channels = user_channels;
        this.onStateChanged();
    }

    get collection() {
        return this._collection;
    }

    set collection(collection: string | undefined) {
        if (collection !== this._collection) {
            this._collection = collection;
            this.onStateChanged();
        }
    }

    get search_scope() {
        return this._collection ? AgentSearchScope.Collection : undefined;
    }

    async restoreConversation(context: WorkflowInteractionVars) {
        
        // Handle version-specific interaction resolution
        let interactionRef = context.interaction;
        if (context.version) {
            const objectIdRegex = /^[a-fA-F0-9]{24}$/;
            if (!objectIdRegex.test(interactionRef)) {
                // regex to check if interactionRef is an object id (24 hex characters), only append version if not an object id
                interactionRef = `${interactionRef}@${context.version}`;
            }
        }
        
        const inter = await this.vertesia.interactions.catalog.resolve(interactionRef);
        const envId = inter.runtime?.environment || context.config?.environment;
        const model = context.config?.model;
        const env = await (envId ?
            this.vertesia.environments.retrieve(context.config?.environment)
            :
            Promise.resolve(undefined)
        );


        this.interactionParamsSchema = context.interactionParamsSchema ?? null;
        // trigger the setter to update the corresponding interactionParamsSchema
        this.interaction = inter;

        this._tool_names = context.tool_names || [];
        this._data = context.data;
        this._interactive = context.interactive;
        this._debug_mode = context.debug_mode ?? false;
        this._checkpoint_tokens = context.checkpoint_tokens;
        this._user_channels = context.user_channels;
        this.collection = context.collection_id ?? undefined;

        // we need to trigger the setter to deal with default models
        this.environment = env;
        if (model) {
            this._model = model;
        }

        this.onStateChanged();
    }

    get interaction() {
        return this._interaction;
    }
    set interaction(interaction: InCodeInteraction | undefined) {
        if (interaction?.id !== this._interaction?.id) {
            this._interaction = interaction;
            // trigger the setter to update the onChange state
            this.interactionParamsSchema = interaction ? mergeInCodePromptSchemas(interaction.prompts) : undefined;
            // Reset the validator when schema changes
            this._inputValidator = undefined;
            if (interaction && !this._preserveRunValues) {
                if (interaction.runtime?.environment) {
                    const envId = interaction.runtime.environment;
                    this.vertesia.environments.retrieve(envId).then((environment) => this.environment = environment);
                }
            }
            this.onStateChanged();
        }
    }

    get environment() {
        return this._environment;
    }
    set environment(environment: ExecutionEnvironmentRef | undefined) {
        if (environment?.id !== this._environment?.id) {
            this._environment = environment;
            if (!this._preserveRunValues) {
                // First try to use the interaction model, then the environment default model
                const interactionModel = this.interaction?.runtime?.model;
                if (interactionModel && environment && supportsToolUse(interactionModel, environment.provider)) {
                    this._model = interactionModel;
                } else {
                    this._model = environment?.default_model && supportsToolUse(environment.default_model, environment.provider)
                        ? environment.default_model : '';
                }
            }

            this.onStateChanged();
        }
    }

    get model() {
        return this._model;
    }
    set model(model: string | undefined) {
        if (model !== this._model) {
            this._model = model || '';
            this.onStateChanged();
        }
    }

    get tool_names() {
        return this._tool_names;
    }
    set tool_names(tools: string[]) {
        this._tool_names = tools;
        this.onStateChanged();
    }

    get data(): JSONObject | undefined {
        return this._data;
    }
    set data(prompt_data: JSONObject) {
        this._data = prompt_data;
        this.onStateChanged();
    }

    set run(run: AsyncExecutionResult | { workflow_id: string; run_id: string }) {
        console.log("run", run);
        this.onStateChanged();
    }

    set start(value: boolean) {
        if (this._start !== value) {
            this._start = value;
            this.onStateChanged();
        }
    }

    get start(): boolean {
        return this._start;
    }

    get preserveRunValues(): boolean {
        return this._preserveRunValues;
    }

    set preserveRunValues(value: boolean) {
        this._preserveRunValues = value;
    }

    get interactionParamsSchema(): JSONSchema | null | undefined {
        return this._interactionParamsSchema;
    }

    set interactionParamsSchema(schema: JSONSchema | null | undefined) {
        if (this._interactionParamsSchema !== schema) {
            this._interactionParamsSchema = schema;
            // Booleans must be true or false, never undefined
            if (schema) {
                this._data = this.initializeBooleanDefaults(this._data || {}, schema);
            }
            this.onStateChanged();
        }
    }

    private initializeBooleanDefaults(data: JSONObject, schema: JSONSchema): JSONObject {
        if (!schema.properties) {
            return data;
        }

        const result = { ...data };

        for (const [name, propSchema] of Object.entries(schema.properties)) {
            const prop = propSchema;
            // Initialize boolean fields to false if not already set
            if (prop.type === "boolean" && result[name] === undefined) {
                result[name] = false;
            } else if (prop.type === "object" && prop.properties) {
                // Recursively initialize nested object booleans
                result[name] = this.initializeBooleanDefaults(
                    (result[name] as JSONObject) || {},
                    prop
                );
            }
        }

        return result;
    }

    reset() {
        this._start = false;
        this._interactive = true;
        this._debug_mode = false;
        this._checkpoint_tokens = undefined;
        this._visibility = undefined;
        this._user_channels = undefined;
        this._collection = undefined;
        this._preserveRunValues = false;
        this._model = '';
        this._environment = undefined;
        this._tool_names = [];
        this._interaction = undefined;
        this._data = undefined;
        this._interactionParamsSchema = null;
        this._inputValidator = undefined;
        this.model = undefined;
        this.environment = undefined;

        this.onStateChanged();

        if (location.hash) {
            const urlWithoutHash = window.location.origin + window.location.pathname + window.location.search;
            history.replaceState(null, '', urlWithoutHash); location.hash = '';
        }
    }

    validateInput(): { isValid: boolean; errorMessage?: string } {
        if (!this._interactionParamsSchema) {
            return { isValid: true };
        }

        // If schema has changed or validator not initialized, recompile
        if (!this._inputValidator || this._inputValidator.schema !== this._interactionParamsSchema) {
            const ajv = new Ajv({ strict: false });
            this._inputValidator = {
                validate: ajv.compile(this._interactionParamsSchema),
                schema: this._interactionParamsSchema
            };
        }

        const prompt_data = this._data || {};
        const isValid = this._inputValidator.validate(prompt_data);

        if (!isValid) {
            const errorMessage: string = this._inputValidator.validate.errors
                ? this._inputValidator.validate.errors.map((err) => `${err.instancePath}: ${err.message}`).join(', ')
                : 'Invalid payload data';
            return { isValid: false, errorMessage };
        }

        return { isValid: true };
    }
}

export const PayloadContext = createContext<PayloadBuilder | undefined>(undefined);

interface PayloadProviderProps {
    children: React.ReactNode;
}
export function PayloadBuilderProvider({ children }: PayloadProviderProps) {
    const { client } = useUserSession();
    const [builder, setBuilder] = useState<PayloadBuilder>();
    useEffect(() => {
        setBuilder(new PayloadBuilder(client, setBuilder));
    }, []);
    return builder && (
        <PayloadContext.Provider value={builder}>{children}</PayloadContext.Provider >
    )
}

export function usePayloadBuilder() {
    const ctx = useContext(PayloadContext);
    if (!ctx) {
        throw new Error('usePayloadBuilder must be used within a PayloadProvider');
    }
    return ctx;
}
