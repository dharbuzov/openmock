"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { Interview } from "@/lib/interview/types";
import type { InterviewDefinition } from "@/lib/interview/types";
import type { Problem } from "@/lib/problems/types";

type InterviewSession = {
  interview: Interview;
  problem: Problem;
  definition: InterviewDefinition;
  setInterview: Dispatch<SetStateAction<Interview>>;
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
  const [interview, setInterview] = useState(initialInterview);
  const value = useMemo(
    () => ({ interview, setInterview, problem, definition }),
    [interview, problem, definition],
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
