import type { Problem } from "@/lib/problems/types";

export interface InterviewMessage {
  id: string;
  role: "interviewer" | "candidate";
  content: string;
}

export interface Interview {
  id: string;
  problem: Problem;
  status: "in-progress" | "completed";
  elapsedSeconds: number;
  messages: InterviewMessage[];
  currentStage: "introduction" | "review";
}
