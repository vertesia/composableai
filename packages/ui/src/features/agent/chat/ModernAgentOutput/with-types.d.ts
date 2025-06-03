import { AgentMessage, Plan } from '@vertesia/common';

// Define a compatible interface to help with type issues
export interface WorkstreamFlowPanelProps {
  messages: AgentMessage[];
  plan?: Plan;
  workstreamStatus: Map<string, 'pending' | 'in_progress' | 'completed'>;
  isOpen?: boolean; // Make isOpen optional
  onClose: () => void;
}

// Declare module for the WorkstreamFlowPanel
declare module '../WorkstreamFlow' {
  export const WorkstreamFlowPanel: React.FC<WorkstreamFlowPanelProps>;
}