import type { Problem } from "@/lib/problems/types";
import type { WorkspaceType } from "@/lib/interview/types";
import { ExcalidrawWorkspace } from "./excalidraw-workspace";
import { CodeWorkspace } from "./code-workspace";

export function Workspace({ problem, type }: { problem: Problem; type: WorkspaceType }) {
  if (type === "diagram") return <ExcalidrawWorkspace />;
  if (type === "code") return <CodeWorkspace starterCode={problem.starterCode ?? ""} />;
  if (type === "project") return <section aria-label="Project workspace" className="h-full p-4 text-sm text-muted-foreground">Project workspace is not configured.</section>;
  return <section aria-label="Conversation-only interview" className="h-full p-4 text-sm text-muted-foreground">This interview uses conversation only.</section>;
}
