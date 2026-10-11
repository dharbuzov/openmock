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
  StageTransition,
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
  const durationMinutes = resolveInterviewDuration(problem, definition);

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
    stage: {
      current: firstStage,
      completed: [],
      startedAt,
      startedElapsedMs: 0,
      allowanceMs: (durationMinutes * 60_000) / definition.stages.length,
    },
    messages: [],
    observations: [],
    startedAt,
    durationMinutes,
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

export function interviewTiming(
  interview: Interview,
  definition: InterviewDefinition,
) {
  // SessionOperations supplies a clock snapshot at every request boundary.
  const elapsedMs = Math.max(
    0,
    interview.elapsedMs ??
      new InterviewTimer(
        Date.now,
        interview.timer ?? {
          elapsedMs: 0,
          runningSince: Date.parse(interview.startedAt),
        },
      ).elapsed(),
  );
  const durationMs = interview.durationMinutes * 60_000;
  const index = definition.stages.findIndex(
    ({ id }) => id === interview.stage.current,
  );
  // The first stage starts at zero. Later legacy stages have no historical active
  // offset: give them a fresh baseline rather than accidentally counting pauses.
  const startedElapsedMs =
    interview.stage.startedElapsedMs ?? (index === 0 ? 0 : elapsedMs);
  const remainingStageCount = Math.max(1, definition.stages.length - index);
  const allowanceMs =
    interview.stage.allowanceMs ??
    Math.max(0, durationMs - startedElapsedMs) / remainingStageCount;
  const stageElapsedMs = Math.max(0, elapsedMs - startedElapsedMs);
  const remainingMs = Math.max(0, durationMs - elapsedMs);
  // Equal shares are a generous generic backstop, not the definition's semantic pacing.
  // Permit 50% extension, provided half a nominal share remains for each later stage.
  const protectedMs =
    (durationMs / definition.stages.length / 2) * (remainingStageCount - 1);
  const stageLimitMs = Math.max(
    0,
    Math.min(allowanceMs * 1.5, durationMs - startedElapsedMs - protectedMs),
  );
  return {
    durationMs,
    elapsedMs,
    remainingMs,
    startedElapsedMs,
    stageElapsedMs,
    allowanceMs,
    stageLimitMs,
    index,
  };
}

// Plan only at a candidate-turn boundary. Nothing is persisted until its response succeeds.
export function planInterviewTurn(
  interview: Interview,
  definition: InterviewDefinition,
  recommendation?: Pick<InterviewTurn, "stageId" | "stageComplete">,
): {
  interview: Interview;
  transition?: StageTransition;
} {
  assertDefinition(interview, definition);
  const current = interview.stage.current;
  const timing = interviewTiming(interview, definition);
  if (
    current === null ||
    timing.index < 0 ||
    interview.status !== "in-progress"
  )
    throw new InterviewStateError("No valid active interview stage.");
  const stageMessages = interview.messages.filter(
    ({ stage }) => stage === current,
  );
  const hasOpportunity =
    stageMessages.some(({ role }) => role === "interviewer") &&
    stageMessages.some(({ role }) => role === "candidate");
  const next = definition.stages[timing.index + 1]?.id ?? null;
  if (
    recommendation &&
    recommendation.stageId !== current &&
    (!recommendation.stageComplete ||
      recommendation.stageId !== next ||
      !hasOpportunity)
  )
    throw new InterviewStateError(
      "The response requested an unapproved stage transition.",
    );
  const answeredTurns = stageMessages.filter(
    ({ role }) => role === "interviewer",
  ).length;
  const stage = {
    ...interview.stage,
    startedElapsedMs: timing.startedElapsedMs,
    allowanceMs: timing.allowanceMs,
  };
  if (interview.messages.at(-1)?.role !== "candidate" || !hasOpportunity)
    return { interview: { ...interview, stage } };
  const reason =
    stage.readyToAdvance || recommendation?.stageComplete
      ? "ready"
      : timing.stageElapsedMs >= timing.stageLimitMs
        ? "time"
        : answeredTurns >= 8
          ? "follow-ups"
          : undefined;
  if (!reason) return { interview: { ...interview, stage } };
  const transition: StageTransition = { from: current, to: next, reason };
  if (next === null) return { interview: { ...interview, stage }, transition };
  return {
    transition,
    interview: {
      ...interview,
      stage: {
        current: next,
        completed: [...new Set([...stage.completed, current])],
        startedAt: now(),
        startedElapsedMs: timing.elapsedMs,
        allowanceMs:
          timing.remainingMs / (definition.stages.length - timing.index - 1),
        readyToAdvance: false,
      },
    },
  };
}

export function applyInterviewTurn(
  interview: Interview,
  definition: InterviewDefinition,
  turn: InterviewTurn,
  transition?: StageTransition,
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
  if (turn.stageId !== currentStage)
    throw new InterviewStateError(
      "The response stage does not match the engine's active stage.",
    );
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
      stage:
        interview.messages.find(({ id }) => id === observation.messageId)
          ?.stage ??
        interview.messages.findLast(({ role }) => role === "candidate")
          ?.stage ??
        currentStage,
    };
  });
  const closing = transition?.to === null;
  if (
    closing &&
    (transition.from !== currentStage ||
      stageIndex !== definition.stages.length - 1)
  )
    throw new InterviewStateError(
      "Only the final stage can close the interview flow.",
    );
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
      ...interview.stage,
      current: closing ? null : currentStage,
      completed: closing
        ? [...new Set([...interview.stage.completed, currentStage])]
        : interview.stage.completed,
      readyToAdvance: turn.stageComplete,
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
