export const VERSION = '20260319'; // YYYYMMDD, client versioning for API endpoints. Increment manually for breaking changes
// Re-exported, not redeclared: the servers read the same constant when deciding how strictly to
// hold a request to its schema, so a name only this side knew could not stay a negotiation.
export { APP_VERSION_HEADER, VERSION_HEADER } from '@vertesia/common';
