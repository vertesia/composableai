import { AsyncExecutionResult, VertesiaClient } from "@vertesia/client";
import { ExecutionEnvironmentRef, InCodeInteraction, mergeInCodePromptSchemas, supportsToolUse, WorkflowInteractionVars } from "@vertesia/common";
import { JSONObject } from "@vertesia/json";
import { useUserSession } from "@vertesia/ui/session";
import Ajv, { ValidateFunction } from "ajv";
import type { JSONSchema4 } from "json-schema";
import React, { createContext, useContext, useEffect, useState } from "react";


// export interface ConversationWorkflowPayload {
//     config: {
//         environment?: ExecutionEnvironmentRef | undefined;
//         model?: string;
//     }
//     data?: JSONObject | undefined,
//     tool_names: string[],
// }

export class PayloadBuilder {
    _interactive: boolean = true;
    _debug_mode: boolean = false;
    _collection: string | undefined;
    _start: boolean = false;
    _preserveRunValues: boolean = false;
    _interaction: InCodeInteraction | undefined;
    _environment: ExecutionEnvironmentRef | undefined;
    _model: string = '';
    _tool_names: string[] = [];
    _data: JSONObject | undefined;

    private _interactionParamsSchema?: JSONSchema4 | null;
    private _inputValidator?: {
        validate: ValidateFunction;
        schema: JSONSchema4;
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
        builder._inputValidator = this._inputValidator;
        builder._start = this._start;
        builder._collection = this._collection;
        builder._preserveRunValues = this._preserveRunValues;
        return builder;
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
        return this._collection ? "collection" : undefined;
    }

    async restoreConversation(context: WorkflowInteractionVars) {
        //TODO (context as any).model and (context as any).environment are there to support assistant format
        // we must align assiustant with studio and remove the 2  || (context as any)
        const inter = await this.vertesia.interactions.catalog.resolve(context.interaction);
        const envId = inter.runtime?.environment || context.config?.environment || (context as any).environment;
        const model = context.config?.environment || (context as any).model;
        const env = await (envId ?
            this.vertesia.environments.retrieve(context.config?.environment)
            :
            Promise.resolve(undefined)
        );


        this.interactionParamsSchema = context.interactionParamsSchema ?? null;
        this._interaction = inter;

        this._tool_names = context.tool_names || [];
        this._data = context.data;
        this._interactive = context.interactive;
        this._debug_mode = context.debug_mode ?? false;
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
            this._interactionParamsSchema = interaction ? mergeInCodePromptSchemas(interaction.prompts) as JSONSchema4 : undefined;
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

    get interactionParamsSchema(): JSONSchema4 | null | undefined {
        return this._interactionParamsSchema;
    }

    set interactionParamsSchema(schema: JSONSchema4 | null | undefined) {
        if (this._interactionParamsSchema !== schema) {
            this._interactionParamsSchema = schema;
            this.onStateChanged();
        }
    }

    reset() {
        this._start = false;
        this._interactive = true;
        this._debug_mode = false;
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
