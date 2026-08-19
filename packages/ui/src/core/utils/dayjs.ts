import dayjs from 'dayjs';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);
dayjs.extend(localizedFormat);

/**
 * dayjs with the plugins this package relies on already registered — import this rather than `dayjs`
 * itself.
 *
 * `dayjs.extend()` mutates a singleton, so a module calling `fromNow()` or a localized format token
 * (`L`, `LT`, …) without registering the plugin itself only works while some unrelated module
 * happens to have been loaded first. That is not a dependency a bundler can see, and tree-shaking
 * is free to drop the module that was doing the registering.
 */
export default dayjs;
