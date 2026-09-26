/**
 * The units `ms` accepts in a duration string, in any case (`'5s'`, `'2 Hours'`, `'1 min'`).
 */
type DurationUnit =
    | 'Years'
    | 'Year'
    | 'Yrs'
    | 'Yr'
    | 'Y'
    | 'Weeks'
    | 'Week'
    | 'W'
    | 'Days'
    | 'Day'
    | 'D'
    | 'Hours'
    | 'Hour'
    | 'Hrs'
    | 'Hr'
    | 'H'
    | 'Minutes'
    | 'Minute'
    | 'Mins'
    | 'Min'
    | 'M'
    | 'Seconds'
    | 'Second'
    | 'Secs'
    | 'Sec'
    | 's'
    | 'Milliseconds'
    | 'Millisecond'
    | 'Msecs'
    | 'Msec'
    | 'Ms';

/**
 * A duration string as the `ms` package parses it: `'100'`, `'5s'`, `'1 hour'`. Declared here rather than
 * imported from `ms`, which this package does not depend on, so the published types resolve without it.
 * Identical to `ms`'s `StringValue`, so a value passes straight to `ms()`.
 */
export type DurationString =
    | `${number}`
    | `${number}${DurationUnit | Uppercase<DurationUnit> | Lowercase<DurationUnit>}`
    | `${number} ${DurationUnit | Uppercase<DurationUnit> | Lowercase<DurationUnit>}`;
