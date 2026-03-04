import { AgentMessage } from "@vertesia/common";
import { cn } from "@vertesia/ui/core";
import { CheckCircle, Clock } from "lucide-react";
import { getWorkstreamId } from "./utils";

interface WorkstreamTabsProps {
  workstreams: Map<string, string>; // Map of workstream_id to displayName
  activeWorkstream: string;
  onSelectWorkstream: (id: string) => void;
  count?: Map<string, number>; // Optional count of messages per workstream
  completionStatus?: Map<string, boolean>; // Optional completion status per workstream
}

/**
 * Component that displays tabs for different workstreams
 */
export default function WorkstreamTabs({
  workstreams,
  activeWorkstream,
  onSelectWorkstream,
  count,
  completionStatus,
}: WorkstreamTabsProps) {
  // Create a new map with just the core workstreams
  const filteredWorkstreams = new Map<string, string>();
  filteredWorkstreams.set("all", "All Messages");
  filteredWorkstreams.set("main", "Main");

  // Only add actual workstreams from messages (not our test workstreams)
  workstreams.forEach((name, id) => {
    if (
      id !== "all" &&
      id !== "main" &&
      id !== "research_france" &&
      id !== "statistics"
    ) {
      filteredWorkstreams.set(id, name);
    }
  });

  // Replace workstreams with our filtered version
  workstreams = filteredWorkstreams;
  // Sort workstream entries in a predictable order:
  // 1. 'all' first
  // 2. 'main' second
  // 3. The rest alphabetically by ID
  const sortedWorkstreams = Array.from(workstreams.entries()).sort(
    ([idA], [idB]) => {
      if (idA === "all") return -1;
      if (idB === "all") return 1;
      if (idA === "main") return -1;
      if (idB === "main") return 1;
      return idA.localeCompare(idB);
    },
  );

  // Only show tabs if there are multiple workstreams (more than just 'all' and 'main')
  const hasMultipleWorkstreams = sortedWorkstreams.length > 2;

  // If there are no multiple workstreams, return an empty div to maintain layout
  if (!hasMultipleWorkstreams) {
    return <div className="py-0.5"></div>;
  }

  return (
    <div className="flex overflow-x-auto space-x-1 mb-1 bg-muted border-b border-muted/20 sticky top-0 z-10">
      {sortedWorkstreams.map(([id, name]) => (
        <button
          key={id}
          className={cn(
            "px-2 py-1 text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5",
            activeWorkstream === id
              ? "bg-info text-info border-b-2 border-info"
              : "text-muted hover:bg-muted border-b-2 border-transparent"
          )}
          onClick={() => onSelectWorkstream(id)}
          title={name.length > 20 ? name : undefined}
        >
          {/* Shorten long names for better UI */}
          {name.length > 20 ? name.substring(0, 18) + "..." : name}
          {count && count.has(id) && count.get(id)! > 0 && (
            <div className="flex items-center space-x-1">
              <span
                className={cn(
                  "inline-flex items-center justify-center p-1 text-xs rounded-full",
                  activeWorkstream === id
                    ? "bg-info text-info"
                    : "bg-muted text-muted"
                )}
              >
                {count.get(id)}
              </span>
              {/* Show completion status indicator if we have it and it's not 'all' */}
              {completionStatus &&
                id !== "all" &&
                (completionStatus.get(id) ? (
                  <CheckCircle className="size-3 text-success" />
                ) : (
                  <Clock className="size-3 text-attention" />
                ))}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

/**
 * Helper function to extract workstream information from messages
 */
export function extractWorkstreams(
  messages: AgentMessage[],
): Map<string, string> {
  const workstreams = new Map<string, string>();

  // Always include "all" and "main" workstreams
  workstreams.set("all", "All Messages");
  workstreams.set("main", "Main");

  // Extract workstream IDs directly from message.workstream_id only
  messages.forEach((message) => {
    if (
      message.workstream_id &&
      message.workstream_id !== "main" &&
      message.workstream_id !== "all" &&
      !workstreams.has(message.workstream_id)
    ) {
      // Use the workstream_id as both the ID and the display name
      workstreams.set(message.workstream_id, message.workstream_id);
      console.log(`Found workstream: ${message.workstream_id}`);
    }
  });

  // Special case: if there's only the 'main' workstream, we want to explicitly make sure it exists
  // This ensures that both 'all' and 'main' are added if no additional workstreams are found
  if (workstreams.size <= 2 && !workstreams.has("main")) {
    workstreams.set("main", "Main");
  }

  console.log("Final workstreams map:", workstreams);

  return workstreams;
}

/**
 * Filter messages by workstream
 */
export function filterMessagesByWorkstream(
  messages: AgentMessage[],
  workstreamId: string,
): AgentMessage[] {
  if (workstreamId === "all") {
    // Show all messages, no filtering needed
    return [...messages];
  } else if (workstreamId === "main") {
    // For the main workstream, show only messages that belong to the main workstream
    // This excludes messages that belong to specific tasks/workstreams
    return messages.filter((message) => {
      const msgWorkstreamId = getWorkstreamId(message);
      return msgWorkstreamId === "main";
    });
  } else {
    // For specific workstreams, show only messages that match the workstream_id
    return messages.filter((message) => {
      const msgWorkstreamId = getWorkstreamId(message);
      return msgWorkstreamId === workstreamId;
    });
  }
}
