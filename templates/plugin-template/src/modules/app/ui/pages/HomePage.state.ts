export interface HomePageState {
    appName: string;
    guidance: string;
}

export function createHomePageState(appName: string): HomePageState {
    return {
        appName,
        guidance: 'Build UI in src/modules/app/ui and resources in src/modules/app/resources.',
    };
}
