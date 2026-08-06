// The app name is a single value shared across package.json `name`,
// VITE_APP_NAME, the manifest, and the `app:<name>:` namespace. Always derive
// `app:` ids from VITE_APP_NAME — never a hardcoded literal.
const APP_NAME = import.meta.env.VITE_APP_NAME;

// Format: app:<plugin-name>:<collection-name>:<interaction-name>
export const ASSISTANT_INTERACTION = 'sys:GeneralAgent';

// Example app-owned type id — an in-code-type STRING, not a project-local
// ObjectId. Pass it directly to client.objects.create({ type: NOTE_TYPE, ... }).
// Never resolve it to an ObjectId — the in-code string is what makes the app
// portable. Replace `note` with your real type's local name.
export const NOTE_TYPE = `app:${APP_NAME}:note`;
