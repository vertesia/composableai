# JSON minification wire fixture

`canonical-json-minification.json` is a synthetic processing input/output fixture. The sole authoritative copy lives in this public common package so standalone SDK checks do not depend on Studio files. It covers six named persisted minification components, applied and unavailable processing outputs, a complete operation receipt, and processing state. Invalid entries cover required tokenizer version, strict fields, and union discriminants.

The processing records were produced with the canonical core append, policy, enqueue, and processing APIs and verified derived lineage. The fixture uses an explicitly trusted test measurement callback; its token counts do not establish production tokenizer integration or request budget readiness. Original source text includes duplicate keys, huge integer, negative zero, and string escape lexemes.

The colocated common test parses these same bytes with the original canonical Zod schemas and the generated `ApiSchemaComponents` using AJV2020. Public alias assertions also check exact schema-inferred types through the common root export. Fixture-generation source and compiled core provenance are retained in the immutable review evidence, rather than installed as a production processor.
