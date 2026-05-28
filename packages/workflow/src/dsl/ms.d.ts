/**
 * Types for the `ms` package (version 3.0.0-canary.1)
 */
declare module 'ms' {
    declare type Unit =
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
    declare type UnitAnyCase = Unit | Uppercase<Unit> | Lowercase<Unit>;
    export declare type StringValue = `${number}` | `${number}${UnitAnyCase}` | `${number} ${UnitAnyCase}`;
    declare function ms(value: StringValue, options?: Options): number;
    declare function ms(value: number, options?: Options): string;
    export default ms;
}
