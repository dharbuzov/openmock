import type { Problem } from "../problems/types";
import type { AISettings } from "../settings/types";
import type {
  Interview,
  InterviewContext,
  InterviewDefinition,
  InterviewLevelId,
  InterviewMode,
  InterviewResult,
  InterviewTurn,
  WorkspaceSnapshot,
  WorkspaceType,
} from "./types";

const newId = () => crypto.randomUUID();
const now = () => new Date().toISOString();

function assertDefinition(
  interview: Interview,
  definition: InterviewDefinition,
): void {
  if (
    interview.definition.id !== definition.id ||
    interview.definition.version !== definition.version ||
    interview.definition.revision !== definition.revision
  ) {
    throw new Error(
      "The interview definition does not match the started interview.",
    );
  }
}

function currentWorkspace(
  definition: InterviewDefinition,
  snapshot?: WorkspaceSnapshot,
): WorkspaceSnapshot {
  const workspace = snapshot ?? emptyWorkspaceSnapshot(definition.workspace);
  if (workspace.type !== definition.workspace)
    throw new Error(
      "The workspace snapshot does not match the interview definition.",
    );
  return workspace;
}

export function emptyWorkspaceSnapshot(type: WorkspaceType): WorkspaceSnapshot {
  switch (type) {
    case "diagram":
      return { type, diagram: { nodes: [], edges: [] } };
    case "code":
      return { type, language: "text", filename: "solution.txt", code: "" };
    case "project":
      return { type, files: [] };
    case "none":
      return { type };
  }
}

export function startInterview(
  problem: Problem,
  options: {
    definition: InterviewDefinition;
    targetLevel: InterviewLevelId;
    mode: InterviewMode;
  },
): Interview {
  const { definition } = options;
  if (problem.interview !== definition.id)
    throw new Error("The problem does not match the interview definition.");
  const { targetLevel, mode } = options;
  const firstStage = definition.stages[0]?.id;
  if (!firstStage)
    throw new Error("Interview definitions require at least one stage.");
  if (!definition.levels.some(({ id }) => id === targetLevel))
    throw new Error("Unsupported target level.");
  if (!definition.modes.includes(mode))
    throw new Error("Unsupported interview mode.");
  const startedAt = now();
  return {
    id: newId(),
    problemId: problem.id,
    definition: {
      id: definition.id,
      version: definition.version,
      revision: definition.revision,
    },
    targetLevel,
    mode,
    status: "in-progress",
    stage: { current: firstStage, completed: [], startedAt },
    messages: [],
    observations: [],
    startedAt,
  };
}

export function acceptCandidateMessage(
  interview: Interview,
  content: string,
): Interview {
  const message = content.trim();
  if (interview.status !== "in-progress" || !message) return interview;
  return {
    ...interview,
    messages: [
      ...interview.messages,
      {
        id: newId(),
        role: "candidate",
        content: message,
        stage: interview.stage.current,
        createdAt: now(),
      },
    ],
  };
}

export function buildInterviewContext(
  interview: Interview,
  problem: Problem,
  definition: InterviewDefinition,
  snapshot?: WorkspaceSnapshot,
): InterviewContext {
  assertDefinition(interview, definition);
  if (interview.problemId !== problem.id || problem.interview !== definition.id)
    throw new Error("The problem does not match the interview definition.");
  return {
    interview,
    problem,
    definition,
    workspace: currentWorkspace(definition, snapshot),
  };
}

export function applyInterviewTurn(
  interview: Interview,
  definition: InterviewDefinition,
  turn: InterviewTurn,
): Interview {
  assertDefinition(interview, definition);
  const currentStage = interview.stage.current;
  const stageIndex = definition.stages.findIndex(
    ({ id }) => id === currentStage,
  );
  if (stageIndex < 0) throw new Error(`Unknown current stage: ${currentStage}`);
  const createdAt = now();
  const validCompetencies = new Set(
    definition.evaluation.competencies.map(({ id }) => id),
  );
  const observations = turn.observations.map((observation) => {
    if (
      observation.competencyId &&
      !validCompetencies.has(observation.competencyId)
    ) {
      throw new Error(`Unknown competency: ${observation.competencyId}`);
    }
    return {
      ...observation,
      id: observation.id || newId(),
      stage: currentStage,
    };
  });
  const completed = turn.stageComplete
    ? [...new Set([...interview.stage.completed, currentStage])]
    : interview.stage.completed;
  const nextStage = turn.stageComplete
    ? (definition.stages[stageIndex + 1]?.id ?? currentStage)
    : currentStage;
  return {
    ...interview,
    messages: [
      ...interview.messages,
      {
        id: newId(),
        role: "interviewer",
        content: turn.message.trim(),
        stage: currentStage,
        createdAt,
      },
    ],
    observations: [...interview.observations, ...observations],
    stage: {
      current: nextStage,
      completed,
      startedAt:
        nextStage === interview.stage.current
          ? interview.stage.startedAt
          : createdAt,
    },
  };
}

export async function processCandidateMessage(
  settings: AISettings,
  interview: Interview,
  problem: Problem,
  definition: InterviewDefinition,
  snapshot?: WorkspaceSnapshot,
  signal?: AbortSignal,
): Promise<Interview> {
  if (
    interview.status !== "in-progress" ||
    interview.messages.at(-1)?.role !== "candidate"
  )
    return interview;
  const { generateInterviewResponse } = await import("../ai/provider");
  const turn = await generateInterviewResponse(
    settings,
    buildInterviewContext(interview, problem, definition, snapshot),
    signal,
  );
  return applyInterviewTurn(interview, definition, turn);
}

export interface FinishedInterview {
  interview: Interview;
  evaluation: InterviewResult;
}

export async function finishInterview(
  settings: AISettings,
  interview: Interview,
  problem: Problem,
  definition: InterviewDefinition,
  snapshot?: WorkspaceSnapshot,
  signal?: AbortSignal,
): Promise<FinishedInterview> {
  if (interview.status !== "in-progress")
    throw new Error("Only an in-progress interview can be finished.");
  const { evaluateInterview } = await import("../ai/evaluation");
  const evaluation = await evaluateInterview(
    settings,
    buildInterviewContext(interview, problem, definition, snapshot),
    signal,
  );
  const finished = {
    ...interview,
    status: "completed" as const,
    completedAt: now(),
    endReason: "candidate-finished" as const,
  };
  return { interview: finished, evaluation };
}
