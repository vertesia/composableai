export interface SearchInterface {
    getFilterValue(name: string): any;
    setFilterValue(name: string, value: any): void;
    clearFilters(autoSearch?: boolean, applyDefaults?: boolean): void;
    search(): Promise<boolean | undefined>;
    readonly isRunning: boolean;
    query: Record<string, any>;
}
