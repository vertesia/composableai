import * as appResources from '../modules/app/resources/index.js';
import * as examplesResources from '../modules/examples/resources/index.js';

export const activities = [...appResources.activities, ...examplesResources.activities];
export const interactions = [...appResources.interactions, ...examplesResources.interactions];
export const skills = [...appResources.skills, ...examplesResources.skills];
export const templates = [...appResources.templates, ...examplesResources.templates];
export const tools = [...appResources.tools, ...examplesResources.tools];
export const types = [...appResources.types, ...examplesResources.types];
