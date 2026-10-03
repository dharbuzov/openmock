import { logger } from "../logging/logger";
import { sessionStorage } from "../storage/local-storage";
import type {
  Interview,
  InterviewDefinition,
  WorkspaceSnapshot,
} from "./types";
import type { Problem } from "../problems/types";

export type InterviewRoomSession = {
  interview: Interview;
  interactionMode: "chat" | "live";
  evaluationWorkspace?: WorkspaceSnapshot;
  evaluationContext?: { problem: Problem; definition: InterviewDefinition };
};

export function saveInterviewSession(session: InterviewRoomSession): void {
  sessionStorage.set(`openmock:interview:${session.interview.id}`, session);
}

export function readInterviewSession(id: string): InterviewRoomSession | null {
  try {
    const session = sessionStorage.get<InterviewRoomSession>(
      `openmock:interview:${id}`,
    );
    if (
      session?.interview.id !== id ||
      !["chat", "live"].includes(session.interactionMode)
    )
      return null;
    return session;
  } catch {
    logger.warn(
      { operation: "storage", reason: "unavailable-or-invalid" },
      "Storage operation failed",
    );
    return null;
  }
}
