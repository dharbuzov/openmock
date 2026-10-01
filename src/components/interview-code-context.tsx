"use client";

import {
  createContext,
  useContext,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";

import type { CodeWorkspaceSnapshot } from "@/lib/interview/types";

type CodeSnapshot = Omit<CodeWorkspaceSnapshot, "type">;
const CodeContext = createContext<RefObject<CodeSnapshot | undefined> | null>(
  null,
);

export function InterviewCodeProvider({ children }: { children: ReactNode }) {
  const snapshot = useRef<CodeSnapshot | undefined>(undefined);
  return <CodeContext value={snapshot}>{children}</CodeContext>;
}

export function useInterviewCode() {
  const context = useContext(CodeContext);
  if (!context) throw new Error("Interview code context is unavailable");
  return context;
}
