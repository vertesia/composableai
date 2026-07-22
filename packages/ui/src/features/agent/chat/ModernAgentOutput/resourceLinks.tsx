import type { AgentResourceAction, AgentResourceType } from '@vertesia/common';
import type { LucideIcon } from 'lucide-react';
import {
    Boxes,
    BrainCircuit,
    Database,
    FileType,
    MessagesSquare,
    PanelsTopLeft,
    PlayCircle,
    SquareTerminal,
    Workflow,
} from 'lucide-react';

const RESOURCE_ICONS: Record<AgentResourceType, LucideIcon> = {
    document: Database,
    collection: Boxes,
    content_type: FileType,
    interaction: MessagesSquare,
    prompt: SquareTerminal,
    agent: BrainCircuit,
    workflow: Workflow,
    process: Workflow,
    process_run: PlayCircle,
    interaction_run: PlayCircle,
    view: PanelsTopLeft,
};

export function getResourceIcon(type: AgentResourceType): LucideIcon {
    return RESOURCE_ICONS[type];
}

/** Badge variant for a resource action, using the semantic color system. */
export function getResourceActionVariant(action: AgentResourceAction): 'success' | 'info' | 'outline' {
    switch (action) {
        case 'created':
            return 'success';
        case 'deleted':
            return 'outline';
        default:
            return 'info';
    }
}
