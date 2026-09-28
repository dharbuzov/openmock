"use client";

import { createContext, useContext, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { AIMessage } from "@/lib/ai/provider";
import type { Problem } from "@/lib/problems/types";
import {
  createInitialSystemDesignState,
  systemDesignOpening,
  type SystemDesignState,
} from "@/lib/interview/system-design";

type InterviewSession = {
  messages: AIMessage[];
  setMessages: Dispatch<SetStateAction<AIMessage[]>>;
  systemDesignState: SystemDesignState | null;
  setSystemDesignState: Dispatch<SetStateAction<SystemDesignState | null>>;
};

const InterviewSessionContext = createContext<InterviewSession | null>(null);

export function InterviewSessionProvider({ children, problem }: { children: ReactNode; problem: Problem }) {
  const [messages, setMessages] = useState<AIMessage[]>(() => problem.type === "system-design"
    ? [{ role: "assistant", content: systemDesignOpening(problem) }]
    : []);
  const [systemDesignState, setSystemDesignState] = useState<SystemDesignState | null>(() => (
    problem.type === "system-design" ? createInitialSystemDesignState() : null
  ));
  const value = useMemo(() => ({
    messages,
    setMessages,
    systemDesignState,
    setSystemDesignState,
  }), [messages, systemDesignState]);
  return <InterviewSessionContext value={value}>{children}</InterviewSessionContext>;
}

export function useInterviewSession(): InterviewSession {
  const context = useContext(InterviewSessionContext);
  if (!context) throw new Error("Interview session provider is unavailable");
  return context;
}
