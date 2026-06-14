import { InteractionCollection } from '@vertesia/tools-sdk';
import assistant from './assistant/index.js';
import icon from './icon.svg.js';
import whatColor from './what_color/index.js';

// Default the collection name to `main` (NOT the app name) so interaction ids are
// the clean `app:<app-name>:main:<interaction>`. Naming the collection after the
// app produces the confusing double id `app:<name>:<name>:<interaction>` and your
// code then references the single-name form and gets 404 "Interaction not found".
export const ExampleInteractions = new InteractionCollection({
    name: 'main',
    title: 'Interactions',
    description: 'App interactions',
    icon,
    interactions: [whatColor, assistant],
});

// config.ts imports `interactions` from here; minimal scaffold exports `[]`.
export const interactions = [ExampleInteractions];
