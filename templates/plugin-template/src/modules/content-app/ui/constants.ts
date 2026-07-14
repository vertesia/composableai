const APP_NAME = import.meta.env.VITE_APP_NAME;

export const ASSISTANT_INTERACTION = 'sys:GeneralAgent';

export const SEED_MARKER = `content-app:${APP_NAME}`;
export const GUIDE_TYPE = `app:${APP_NAME}:guide`;
export const LOCATION_TYPE = `app:${APP_NAME}:location`;
export const REVIEW_TASK_TYPE = `app:${APP_NAME}:review_task`;

export const GUIDE_SUMMARIZER_INTERACTION = `app:${APP_NAME}:main:guide_summarizer`;
export const FIELD_SUGGESTER_INTERACTION = `app:${APP_NAME}:main:field_suggester`;
export const REVIEW_CHECKLIST_INTERACTION = `app:${APP_NAME}:main:review_checklist_builder`;

export const GUIDE_REVIEW_PROCESS = `app:${APP_NAME}:guide-review`;
