declare module 'culori' {
    export interface Color {
        mode?: string;
        alpha?: number;
    }

    export function parse(color: string): Color | undefined;
    export function formatRgb(color: Color): string;
}

declare module 'wcag-contrast' {
    export function rgb(foreground: [number, number, number], background: [number, number, number]): number;
}
