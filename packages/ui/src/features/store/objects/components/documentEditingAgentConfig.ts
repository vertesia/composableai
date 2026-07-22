export const DOCUMENT_EDITING_TOOLS = [
    'ask_user',
    'think',
    'plan',
    'update_plan',
    'end_conversation',
    'learn_artifact_operations',
    'learn_code_execution',
    'learn_content_authoring',
    'learn_document_management',
    'learn_document_search',
    'learn_image_analysis',
    // Available immediately as well as through the code_execution skill so an
    // editing agent can regenerate charts and other derived assets.
    'execute_shell',
    // Read access to canonical revisions: reconcile-after-conflict and change
    // summaries fetch other revisions into reference artifacts for comparison.
    'fetch_document',
];

// Artifact operations and code execution are core editing capabilities, so their
// guidance and tools are active before the first model turn. Other skills remain
// available through their learn_* tools when the task calls for them.
export const DOCUMENT_EDITING_INITIAL_SKILLS = ['artifact_operations', 'code_execution'];

// Editing sessions mutate only the working-copy artifact; the canonical document is
// published exclusively through Save to document. These tools stay unavailable even
// if a skill or tool refresh would otherwise unlock them.
export const DOCUMENT_EDITING_EXCLUDED_TOOLS = [
    'update_document',
    'update_document_properties',
    'create_document',
    'set_document_type',
    'merge_documents',
    'import_file',
    'create_or_update_object_type',
    'disable_type',
    // Keep multi-command fan-out unavailable; execute_shell is intentionally
    // allowed as the single, observable sandbox execution path.
    'batch_execute',
];
