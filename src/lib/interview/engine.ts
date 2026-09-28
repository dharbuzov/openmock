import { getProblem } from "@/lib/problems/loader";
import type { Interview } from "./types";

// Reproducible demo IDs let links survive reloads without storing sessions.
export async function createInterview(problemId: string): Promise<Interview | undefined> {
  const problem = await getProblem(problemId);
  if (!problem) return undefined;
  return {
    id: `demo-${problem.id}`,
    problem,
    status: "in-progress",
    elapsedSeconds: 0,
    currentStage: "introduction",
    messages: [{
      id: "intro",
      role: "interviewer",
      content: `Let's work through ${problem.title}. Start by clarifying the requirements and describing your approach.`,
    }],
  };
}

export async function getDummyInterview(id: string): Promise<Interview | undefined> {
  if (!id.startsWith("demo-")) return undefined;
  return createInterview(id.slice(5));
}

export async function completeInterview(id: string): Promise<Interview | undefined> {
  const interview = await getDummyInterview(id);
  return interview ? { ...interview, status: "completed", currentStage: "review" } : undefined;
}
