"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { resolveInterviewDuration } from "@/lib/interview/duration";
import {
  readInterviewSession,
  saveInterviewSession,
} from "@/lib/interview/session-storage";
import type { Interview } from "@/lib/interview/types";
import type { InterviewDefinition } from "@/lib/interview/types";
import type { Problem } from "@/lib/problems/types";

import {
  SessionOperations,
  type SessionState,
} from "@/lib/interview/session-operations";

import { useInterviewCode } from "./interview-code-context";
import { useInterviewDiagram } from "./interview-diagram-context";
import { captureWorkspaceSnapshot } from "@/lib/interview/workspace";

type InterviewSession = {
  interview: Interview;
  problem: Problem;
  definition: InterviewDefinition;
  operation: SessionState["operation"];
  paused: boolean;
  elapsed: SessionOperations["elapsed"];
  toggleTimer: SessionOperations["toggleTimer"];
  beginOperation: SessionOperations["begin"];
  commitOperation: SessionOperations["commit"];
  endOperation: SessionOperations["end"];
  isCurrentOperation: SessionOperations["isCurrent"];
};

const InterviewSessionContext = createContext<InterviewSession | null>(null);

export function InterviewSessionProvider({
  children,
  initialInterview,
  problem,
  definition,
}: {
  children: ReactNode;
  initialInterview: Interview;
  problem: Problem;
  definition: InterviewDefinition;
}) {
  const [state, setState] = useState<SessionState>(() => ({
    interview: {
      ...initialInterview,
      durationMinutes: resolveInterviewDuration(
        problem,
        definition,
        initialInterview.durationMinutes,
      ),
    },
    operation: null,
  }));
  const [operations] = useState(
    () =>
      new SessionOperations(state.interview, (next) => {
        setState(next);
        saveInterviewSession({
          ...readInterviewSession(next.interview.id),
          interview: next.interview,
        });
      }),
  );
  useEffect(() => {
    const checkpoint = () => operations.checkpoint();
    window.addEventListener("pagehide", checkpoint);
    return () => {
      window.removeEventListener("pagehide", checkpoint);
      operations.cancel();
    };
  }, [operations]);
  const value = useMemo(
    () => ({
      ...state,
      paused: operations.isPaused(),
      elapsed: operations.elapsed,
      toggleTimer: operations.toggleTimer,
      problem,
      definition,
      beginOperation: operations.begin,
      commitOperation: operations.commit,
      endOperation: operations.end,
      isCurrentOperation: operations.isCurrent,
    }),
    [state, problem, definition, operations],
  );
  return (
    <InterviewSessionContext value={value}>{children}</InterviewSessionContext>
  );
}

export function useInterviewSession(): InterviewSession {
  const context = useContext(InterviewSessionContext);
  if (!context) throw new Error("Interview session provider is unavailable");
  return context;
}

export function useCaptureWorkspace() {
  const code = useInterviewCode();
  const { captureCurrentArchitecture } = useInterviewDiagram();
  const { definition } = useInterviewSession();
  return () =>
    captureWorkspaceSnapshot(definition.workspace, {
      code: () => code.current,
      diagram: captureCurrentArchitecture,
    });
}
