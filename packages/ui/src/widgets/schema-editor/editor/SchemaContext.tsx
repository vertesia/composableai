import { useState } from "react";
import { ManagedSchema } from "../ManagedSchema.js";

export function useSchema(jsonSchema: any) {
    const [schema, setSchema] = useState(new ManagedSchema(jsonSchema || { type: "object", properties: {} }).withChangeListener((schema) => {
        setSchema(schema.clone());
    }));
    return schema;
}
