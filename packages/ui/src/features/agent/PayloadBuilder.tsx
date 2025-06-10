import { AsyncExecutionResult, VertesiaClient } from "@vertesia/client";
import { ExecutionEnvironmentRef, Interaction, mergePromptsSchema, PopulatedInteraction } from "@vertesia/common";
import { JSONObject } from "@vertesia/json";
import { useUserSession } from "@vertesia/ui/session";
import Ajv, { ValidateFunction } from "ajv";
import React, { createContext, useContext, useEffect, useState } from "react";
import type { JSONSchema4 } from "json-schema";

export interface ConversationWorkflowPayload {
    interaction?: Interaction | undefined;
    environment?: ExecutionEnvironmentRef | undefined;
    model?: string;
    prompt_data?: JSONObject | undefined,
    tools: string[],
}

export class PayloadBuilder implements ConversationWorkflowPayload {
    _interactive: boolean = true;
    _start: boolean = false;

    payload: ConversationWorkflowPayload;
    private _interactionParamsSchema?: JSONSchema4 | null;
    private _inputValidator?: {
        validate: ValidateFunction;
        schema: JSONSchema4;
    };

    constructor(public vertesia: VertesiaClient, public updateState: (data: PayloadBuilder) => void) {
        this.payload = {
            model: '',
            tools: [],
        }
    }

    onStateChanged() {
        const newInstance = this.clone();
        this.updateState(newInstance);
    }

    clone() {
        const builder = new PayloadBuilder(this.vertesia, this.updateState);
        builder._interactionParamsSchema = this._interactionParamsSchema;
        builder.payload = this.payload;
        builder._interactive = this._interactive;
        builder._inputValidator = this._inputValidator;
        builder._start = this._start;
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

    get interaction() {
        return this.payload.interaction;
    }
    set interaction(interaction: Interaction | undefined) {
        if (interaction?.id !== this.payload.interaction?.id) {
            this.payload.interaction = interaction;
            this._interactionParamsSchema = mergePromptsSchema(this.interaction as PopulatedInteraction) as JSONSchema4;
            // Reset the validator when schema changes
            this._inputValidator = undefined;
            if (interaction) {
                if (interaction.model) {
                    this.payload.model = interaction.model;
                } else {
                    this.payload.model = undefined;
                }
                if (interaction.environment) {
                    if (typeof interaction.environment === 'string') {
                        this.vertesia.environments.retrieve(interaction.environment).then((environment) => this.environment = environment);
                    } else {
                        this.payload.environment = interaction.environment;
                    }
                }
            }
            this.onStateChanged();
        }
    }

    get environment() {
        return this.payload.environment;
    }
    set environment(environment: ExecutionEnvironmentRef | undefined) {
        if (environment?.id !== this.payload.environment?.id) {
            this.payload.environment = environment;
            this.onStateChanged();
        }
    }

    get model() {
        return this.payload.model;
    }
    set model(model: string | undefined) {
        if (model !== this.payload.model) {
            this.payload.model = model;
            this.onStateChanged();
        }
    }

    get tools() {
        return this.payload.tools;
    }
    set tools(tools: string[]) {
        this.payload.tools = tools;
        this.onStateChanged();
    }

    get prompt_data(): JSONObject | undefined {
        return this.payload.prompt_data;
    }
    set prompt_data(prompt_data: JSONObject) {
        this.payload.prompt_data = prompt_data;
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
        this.payload = {
            model: '',
            tools: [],
            interaction: undefined,
            environment: undefined,
            prompt_data: undefined
        };
        this._interactionParamsSchema = null;
        this._inputValidator = undefined;

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

        const prompt_data = this.payload.prompt_data || {};
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
