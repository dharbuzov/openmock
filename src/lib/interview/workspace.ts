import { emptyWorkspaceSnapshot } from "./engine";
import type {
  CodeWorkspaceSnapshot,
  DiagramWorkspaceSnapshot,
  WorkspaceSnapshot,
  WorkspaceType,
} from "./types";

export function captureWorkspaceSnapshot(
  type: WorkspaceType,
  readers: {
    code: () => Omit<CodeWorkspaceSnapshot, "type"> | undefined;
    diagram: () => DiagramWorkspaceSnapshot["diagram"];
  },
): WorkspaceSnapshot {
  if (type === "diagram") return { type, diagram: readers.diagram() };
  if (type === "code") {
    const code = readers.code();
    if (code) return { type, ...code };
  }
  return emptyWorkspaceSnapshot(type);
}
