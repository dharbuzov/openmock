import { resolveInterviewDuration } from "./duration";
import { InterviewTimer } from "./timer";
import type { Problem } from "../problems/types";
import type {
  Interview,
  InterviewContext,
  InterviewDefinition,
  InterviewLevelId,
  InterviewMode,
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

export class InterviewOptionsError extends Error {}
export class InterviewStateError extends Error {}

export function startInterview(
  problem: Problem,
  options: {
    definition: InterviewDefinition;
    targetLevel?: InterviewLevelId;
    mode?: InterviewMode;
  },
): Interview {
  const { definition } = options;
  if (problem.interview !== definition.id)
    throw new Error("The problem does not match the interview definition.");
  const targetLevel = options.targetLevel ?? definition.defaultLevel;
  const mode = options.mode ?? definition.defaultMode;
  const firstStage = definition.stages[0]?.id;
  if (!firstStage)
    throw new Error("Interview definitions require at least one stage.");
  if (!targetLevel || !definition.levels.some(({ id }) => id === targetLevel))
    throw new InterviewOptionsError("Unsupported target level.");
  if (!mode || !definition.modes.includes(mode))
    throw new InterviewOptionsError("Unsupported interview mode.");
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
    durationMinutes: resolveInterviewDuration(problem, definition),
    timer: { elapsedMs: 0, runningSince: Date.parse(startedAt) },
  };
}

export function acceptCandidateMessage(
  interview: Interview,
  content: string,
): Interview {
  const message = content.trim();
  if (interview.status !== "in-progress" || !message) return interview;
  if (interview.stage.current === null)
    throw new InterviewStateError("No active interview stage.");
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
  if (interview.status !== "in-progress")
    throw new InterviewStateError(
      "Only an in-progress interview can receive a turn.",
    );
  const currentStage = interview.stage.current;
  if (currentStage === null)
    throw new InterviewStateError("No active interview stage.");
  const stageIndex = definition.stages.findIndex(
    ({ id }) => id === currentStage,
  );
  if (stageIndex < 0) {
    throw new InterviewStateError(`Unknown current stage: ${currentStage}`);
  }
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
    ? (definition.stages[stageIndex + 1]?.id ?? null)
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

export function completeInterview(interview: Interview): Interview {
  if (interview.status !== "in-progress")
    throw new InterviewStateError(
      "Only an in-progress interview can be completed.",
    );
  const timer = new InterviewTimer(
    Date.now,
    interview.timer ?? {
      elapsedMs: interview.elapsedMs ?? 0,
      runningSince:
        interview.elapsedMs === undefined
          ? Date.parse(interview.startedAt)
          : null,
    },
  );
  timer.pause();
  return {
    ...interview,
    timer: timer.snapshot(),
    elapsedMs: timer.elapsed(),
    status: "completed",
    completedAt: now(),
    endReason: "candidate-finished",
    stage: { ...interview.stage, current: null },
  };
}
