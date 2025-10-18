interface defaultKeys {
    [key: string]: string;
}
export interface SearchInterface {
    getFilterValue(name: string): any;
    setFilterValue(name: string, value: any): void;
    clearFilters(autoSearch?: boolean, applyDefaults?: boolean): void;
    search(applyDefaults?: boolean): Promise<boolean | undefined>;
    setDefaultKeys(keys: defaultKeys[]): void;
    readonly isRunning: boolean;
    query: Record<string, any>;
}
