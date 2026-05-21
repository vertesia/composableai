import { useState } from "react";
import type { JSONSchema } from "@vertesia/common";
import { ManagedSchema } from "../ManagedSchema.js";

export function useSchema(jsonSchema: string | JSONSchema | null | undefined) {
    const [schema, setSchema] = useState(new ManagedSchema(jsonSchema || { type: "object", properties: {} }).withChangeListener((schema) => {
        setSchema(schema.clone());
    }));
    return schema;
}
