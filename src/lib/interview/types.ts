import type { ArchitectureDiagram } from "../diagram/types";
import type { Problem } from "../problems/types";
import type { SystemDesignState } from "./system-design";

export interface InterviewMessage {
  role: "user" | "assistant";
  content: string;
}

export type InterviewWorkspaceSnapshot =
  | {
    kind: "dsa";
    code?: { language: string; content: string };
  }
  | {
    kind: "system-design";
    architectureDiagram: ArchitectureDiagram;
  };

export interface Interview {
  id: string;
  problem: Problem;
  status: "in-progress" | "completed";
  messages: InterviewMessage[];
  systemDesignState: SystemDesignState | null;
  workspaceSnapshot: InterviewWorkspaceSnapshot;
}
