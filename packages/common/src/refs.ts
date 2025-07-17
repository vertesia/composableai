

export enum ResolvableRefType {
    project = "Project",
    projects = "Projects",
    environment = "Environment",
    user = "User",
    account = "Account",
    interaction = "Interaction",
    userGroup = "UserGroup"
}

export interface ResolvableRef {
    type: ResolvableRefType
    id: string
}

export interface RefResolutionRequest {

    refs: ResolvableRef[]

}


export interface ResourceRef {
    id: string
    name: string
    type: string
    description?: string
}