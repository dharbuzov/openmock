import type { Problem } from "@/lib/problems/types";
import type { WorkspaceType } from "@/lib/interview/types";
import { ExcalidrawWorkspace } from "./excalidraw-workspace";
import { CodeWorkspace } from "./code-workspace";

function WorkspaceContent({
  problem,
  type,
}: {
  problem: Problem;
  type: WorkspaceType;
}) {
  if (type === "diagram") return <ExcalidrawWorkspace />;
  if (type === "code")
    return <CodeWorkspace starterCode={problem.starterCode ?? ""} />;
  if (type === "project")
    return (
      <section
        aria-label="Project workspace"
        className="h-full p-4 text-sm text-muted-foreground"
      >
        Project workspace is not configured.
      </section>
    );
  return (
    <section
      aria-label="Conversation-only interview"
      className="h-full p-4 text-sm text-muted-foreground"
    >
      This interview uses conversation only.
    </section>
  );
}

export function Workspace(props: { problem: Problem; type: WorkspaceType }) {
  return (
    <section
      aria-labelledby="workspace-heading"
      className="flex h-full min-h-0 flex-col"
    >
      <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b px-4">
        <h2 id="workspace-heading" className="shrink-0 text-xs font-medium">
          Workspace
        </h2>
      </div>
      <div className="min-h-0 flex-1">
        <WorkspaceContent {...props} />
      </div>
    </section>
  );
}
