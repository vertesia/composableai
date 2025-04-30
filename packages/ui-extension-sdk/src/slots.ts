export interface LinksParams {
    // Define properties specific to LinksParams
    linkUrl: string;
}

export interface PageParams {
    // Define properties specific to PageParams
    pageTitle: string;
}

export interface FooterParams {
    // Define properties specific to FooterParams
    footerText: string;
}

export type MountContext =
    | { slot: "links", params: LinksParams }
    | { slot: "page", params: PageParams }
    | { slot: "footer", params: FooterParams };
