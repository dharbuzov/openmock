"use client";

import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { AIMessage } from "@/lib/ai/provider";

type InterviewSession = {
  messages: AIMessage[];
  setMessages: Dispatch<SetStateAction<AIMessage[]>>;
};

const InterviewSessionContext = createContext<InterviewSession | null>(null);

export function InterviewSessionProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  return <InterviewSessionContext value={{ messages, setMessages }}>{children}</InterviewSessionContext>;
}

export function useInterviewSession(): InterviewSession {
  const context = useContext(InterviewSessionContext);
  if (!context) throw new Error("Interview session provider is unavailable");
  return context;
}
