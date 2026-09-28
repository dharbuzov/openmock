import type {
  EvaluationRequest,
  InterviewEvaluation,
} from "../ai/evaluation";
import type {
  AIRequest,
  InterviewTurnResult,
} from "../ai/provider";
import type { Problem } from "../problems/types";
import type { AISettings } from "../settings/types";
import {
  createInitialSystemDesignState,
  systemDesignOpening,
} from "./system-design";
import type {
  Interview,
  InterviewWorkspaceSnapshot,
} from "./types";

function initialWorkspace(problem: Problem): InterviewWorkspaceSnapshot {
  return problem.type === "system-design"
    ? { kind: "system-design", architectureDiagram: { nodes: [], edges: [] } }
    : { kind: "dsa" };
}

function currentWorkspace(
  interview: Interview,
  snapshot?: InterviewWorkspaceSnapshot,
): InterviewWorkspaceSnapshot {
  if (!snapshot) return interview.workspaceSnapshot;
  if (snapshot.kind !== interview.problem.type) {
    throw new Error("The workspace snapshot does not match the interview type.");
  }
  return snapshot;
}

export function startInterview(problem: Problem): Interview {
  const isSystemDesign = problem.type === "system-design";
  return {
    id: problem.id,
    problem,
    status: "in-progress",
    messages: isSystemDesign
      ? [{ role: "assistant", content: systemDesignOpening(problem) }]
      : [],
    systemDesignState: isSystemDesign ? createInitialSystemDesignState() : null,
    workspaceSnapshot: initialWorkspace(problem),
  };
}

export function acceptCandidateMessage(interview: Interview, content: string): Interview {
  const message = content.trim();
  if (interview.status !== "in-progress" || !message) return interview;
  return {
    ...interview,
    messages: [...interview.messages, { role: "user", content: message }],
  };
}

export function buildInterviewContext(
  interview: Interview,
  snapshot?: InterviewWorkspaceSnapshot,
): AIRequest {
  const workspace = currentWorkspace(interview, snapshot);
  return {
    problem: interview.problem,
    messages: interview.messages,
    ...(workspace.kind === "dsa" && workspace.code ? { code: workspace.code } : {}),
    ...(workspace.kind === "system-design" ? {
      systemDesignState: interview.systemDesignState ?? undefined,
      architectureDiagram: workspace.architectureDiagram,
    } : {}),
  };
}

function applyInterviewTurn(
  interview: Interview,
  workspaceSnapshot: InterviewWorkspaceSnapshot,
  result: InterviewTurnResult,
): Interview {
  return {
    ...interview,
    messages: [...interview.messages, { role: "assistant", content: result.content }],
    systemDesignState: result.systemDesignState ?? interview.systemDesignState,
    workspaceSnapshot,
  };
}

export async function processCandidateMessage(
  settings: AISettings,
  interview: Interview,
  snapshot?: InterviewWorkspaceSnapshot,
  signal?: AbortSignal,
): Promise<Interview> {
  if (interview.status !== "in-progress" || interview.messages.at(-1)?.role !== "user") {
    return interview;
  }
  const { generateInterviewResponse } = await import("../ai/provider");
  const workspaceSnapshot = currentWorkspace(interview, snapshot);
  const result = await generateInterviewResponse(
    settings,
    buildInterviewContext(interview, workspaceSnapshot),
    signal,
  );
  return applyInterviewTurn(interview, workspaceSnapshot, result);
}

export function buildEvaluationContext(
  interview: Interview,
  snapshot?: InterviewWorkspaceSnapshot,
): EvaluationRequest {
  return buildInterviewContext(interview, snapshot);
}

export interface FinishedInterview {
  interview: Interview;
  evaluation: InterviewEvaluation;
}

function completedInterview(
  interview: Interview,
  workspaceSnapshot: InterviewWorkspaceSnapshot,
  evaluation: InterviewEvaluation,
): FinishedInterview {
  return {
    interview: { ...interview, status: "completed", workspaceSnapshot },
    evaluation,
  };
}

export async function finishInterview(
  settings: AISettings,
  interview: Interview,
  snapshot?: InterviewWorkspaceSnapshot,
  signal?: AbortSignal,
): Promise<FinishedInterview> {
  if (interview.status !== "in-progress") {
    throw new Error("Only an in-progress interview can be finished.");
  }
  const { evaluateInterview } = await import("../ai/evaluation");
  const workspaceSnapshot = currentWorkspace(interview, snapshot);
  const evaluation = await evaluateInterview(
    settings,
    buildEvaluationContext(interview, workspaceSnapshot),
    signal,
  );
  const finished = completedInterview(interview, workspaceSnapshot, evaluation);
  const { saveEvaluation } = await import("./evaluation-storage");
  saveEvaluation(finished.interview.id, finished.evaluation);
  return finished;
}
