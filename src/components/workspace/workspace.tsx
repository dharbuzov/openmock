import type { Problem } from "@/lib/problems/types";
import { ExcalidrawWorkspace } from "./excalidraw-workspace";
import { CodeWorkspace } from "./code-workspace";

export function Workspace({ problem }: { problem: Problem }) {
  if (problem.type === "system-design") return <ExcalidrawWorkspace />;
  return <CodeWorkspace starterCode={problem.starterCode ?? ""} />;
}
