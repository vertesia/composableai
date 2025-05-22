export type JSONPrimitive = string | number | boolean | null;
export type JSONArray = JSONValue[];
export type JSONObject = { [key: string]: JSONValue };
export type JSONComposite = JSONArray | JSONObject;
export type JSONValue = JSONPrimitive | JSONComposite;
