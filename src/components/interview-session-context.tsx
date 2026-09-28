"use client";

import { createContext, useContext, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { Interview } from "@/lib/interview/types";

type InterviewSession = {
  interview: Interview;
  setInterview: Dispatch<SetStateAction<Interview>>;
};

const InterviewSessionContext = createContext<InterviewSession | null>(null);

export function InterviewSessionProvider({ children, initialInterview }: { children: ReactNode; initialInterview: Interview }) {
  const [interview, setInterview] = useState(initialInterview);
  const value = useMemo(() => ({ interview, setInterview }), [interview]);
  return <InterviewSessionContext value={value}>{children}</InterviewSessionContext>;
}

export function useInterviewSession(): InterviewSession {
  const context = useContext(InterviewSessionContext);
  if (!context) throw new Error("Interview session provider is unavailable");
  return context;
}
