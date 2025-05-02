
export interface Slot {
    readonly name: string;
}

export class PageSlot implements Slot {
    readonly name = "page";
    // the page path relative to the plugin root
    constructor(public path: string) {
    }
}
