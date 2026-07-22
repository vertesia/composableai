import type { InCodeViewDefinition } from '@vertesia/common';
import { DocumentLibraryView } from './document-library.js';

/** In-code View Experiences contributed by this app (as `app:<app-name>:<view-id>`). */
export const views: InCodeViewDefinition[] = [DocumentLibraryView];
