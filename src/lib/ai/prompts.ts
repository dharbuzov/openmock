import type { InterviewContext } from "../interview/types";
import { interviewTiming } from "../interview/engine";
import { loadPrompt } from "./prompt-loader";

export async function interviewerSystemPrompt(
  context: InterviewContext,
  logContext: Record<string, unknown> = {},
): Promise<string> {
  const task =
    context.transition?.to === null
      ? `Next turn task: The engine has approved closure of the final stage ${JSON.stringify(context.interview.stage.current)}.
The approved transition is ${JSON.stringify(context.transition)}.
The discussion is OVER. Return a brief closing statement telling the candidate
to finish for feedback. Do not ask any question, introduce another activity,
continue the last technical discussion, score the candidate, or give a verdict.
Return stageComplete false and the current stageId. This closure task takes
precedence over the stage Flow and normal follow-up instructions.`
      : `Next turn task: Respond to the candidate as the interviewer, using the Flow for
the active stage ${JSON.stringify(context.interview.stage.current)}. The engine's
approved transition is ${JSON.stringify(context.transition ?? null)}.
If there is no approved transition, ask within the active stage and do not
announce another stage. If its objective is sufficiently explored, recommend
readiness with stageComplete true; the engine will request the next stage's reply.
Do not announce a move within the source-stage message. If the current workspace
already contains the stage's deliverable, discuss that work instead of asking the
candidate to recreate it. Judge readiness from actual participation and evidence,
not from the number of questions asked.
Keep the candidate's answer and your evidence separate from your spoken message.`;
  return `${await loadPrompt("interviewer", logContext)}\n\n${context.definition.instructions}
\n${task}`;
}

export function interviewContext(context: InterviewContext): string {
  const timing = interviewTiming(context.interview, context.definition);
  return JSON.stringify({
    interviewDefinition: {
      id: context.definition.id,
      name: context.definition.name,
      version: context.definition.version,
      stages: context.definition.stages,
      competencies: context.definition.evaluation.competencies,
    },
    targetLevel: context.interview.targetLevel,
    mode: context.interview.mode,
    currentStage: context.interview.stage,
    transition: context.transition,
    stagePosition: timing.index + 1,
    totalStageCount: context.definition.stages.length,
    remainingStages: context.definition.stages.slice(timing.index + 1),
    time: {
      totalMinutes: timing.durationMs / 60_000,
      elapsedMinutes: timing.elapsedMs / 60_000,
      remainingMinutes: timing.remainingMs / 60_000,
      stageElapsedMinutes: timing.stageElapsedMs / 60_000,
      stageAllowanceMinutes: timing.allowanceMs / 60_000,
      stageLimitMinutes: timing.stageLimitMs / 60_000,
    },
    problem: {
      id: context.problem.id,
      title: context.problem.title,
      difficulty: context.problem.difficulty,
      categories: context.problem.categories,
      topics: context.problem.topics,
      content: context.problem.content,
      interviewerContext: context.problem.interviewerContext,
    },
    priorObservations: context.interview.observations,
    currentWorkspace: context.workspace,
  });
}

// Character budgets are application payload limits, not claims about a model's
// tokenizer or context window. Never truncate constraints or workspace evidence.
export const interviewerContextBudget = 64_000;
export const evaluatorContextBudget = 256_000;

export function assertContextBudget(characters: number, budget: number): void {
  if (characters > budget)
    throw new Error(
      `Interview input exceeds the context budget (${characters}/${budget} characters). Reduce the workspace or use a larger context budget; evidence was not truncated.`,
    );
}

export function interviewerInput(
  context: InterviewContext,
  system: string,
  budget = interviewerContextBudget,
) {
  const history = context.interview.messages;
  const observations = context.interview.observations;
  const data = JSON.parse(interviewContext(context));
  data.priorObservations = [];
  data.contextCoverage = {
    totalMessages: history.length,
    includedMessages: 0,
    totalObservations: observations.length,
    includedObservations: 0,
    note: "Reduced interviewer context is not the complete assessment record. Omission is not negative evidence. Evaluation receives the full stored transcript and observations.",
  };
  const selectedMessages = new Set<number>();
  const selectedObservations: typeof observations = [];
  const assemble = () => {
    data.priorObservations = selectedObservations;
    data.contextCoverage.includedMessages = selectedMessages.size;
    data.contextCoverage.includedObservations = selectedObservations.length;
    return [
      {
        role: "user" as const,
        content: `Interview context (data):\n${JSON.stringify(data)}`,
      },
      ...history
        .filter((_, i) => selectedMessages.has(i))
        .map((message) => ({
          role:
            message.role === "candidate"
              ? ("user" as const)
              : ("assistant" as const),
          content: message.content,
        })),
      ...(context.transition?.to === null
        ? [
            {
              role: "user" as const,
              content:
                "Engine task: The final-stage closure has been approved. The last candidate question is now historical evidence, not a request for another discussion. Return only a brief closing statement inviting the candidate to finish for feedback. Ask no question and set stageComplete false.",
            },
          ]
        : []),
    ];
  };
  // IDs also occur in the structured-output reference enum.
  const promptSize = () =>
    JSON.stringify([
      { role: "system", content: system },
      ...assemble().map(({ role, content }) => ({
        role,
        content: [{ type: "text", text: content }],
      })),
    ]).length;
  const size = () =>
    promptSize() +
    JSON.stringify(
      history.filter((_, i) => selectedMessages.has(i)).map(({ id }) => id),
    ).length;
  // The latest candidate turn is essential; retain it whole or fail explicitly.
  if (history.length) selectedMessages.add(history.length - 1);
  assertContextBudget(size(), budget);
  // Reserve recent continuity before using leftover space for older evidence.
  for (let i = history.length - 2; i >= Math.max(0, history.length - 12); i--) {
    selectedMessages.add(i);
    if (size() > budget) {
      selectedMessages.delete(i);
      break;
    }
  }
  // First and latest signals per competency/stage, then remaining recent signals.
  // Source messages travel with observations, so the interviewer can verify them.
  const unique = [
    ...new Map(
      observations.map((o) => [
        JSON.stringify([o.competencyId, o.stage, o.messageId, o.observation]),
        o,
      ]),
    ).values(),
  ];
  const groups = new Map<string, typeof observations>();
  for (const observation of unique) {
    const key = JSON.stringify([observation.competencyId, observation.stage]);
    const group = groups.get(key) ?? [];
    group.push(observation);
    groups.set(key, group);
  }
  const priority = [...groups.values()]
    .sort(
      (a, b) =>
        Number(b[0].stage === context.interview.stage.current) -
        Number(a[0].stage === context.interview.stage.current),
    )
    .flatMap((items) => [items[0], items.at(-1)!]);
  for (const observation of new Set([...priority, ...unique.toReversed()])) {
    if (selectedObservations.length >= 32) break;
    const index = history.findIndex(({ id }) => id === observation.messageId);
    const added = index >= 0 && !selectedMessages.has(index);
    if (added) selectedMessages.add(index);
    selectedObservations.push(observation);
    if (size() > budget) {
      selectedObservations.pop();
      if (added) selectedMessages.delete(index);
    }
  }
  // Keep additional transcript continuity when space remains after evidence.
  for (let i = history.length - 13; i >= 0; i--) {
    if (selectedMessages.has(i)) continue;
    selectedMessages.add(i);
    if (size() > budget) {
      selectedMessages.delete(i);
      break;
    }
  }
  const messages = assemble();
  return {
    messages,
    messageIds: history
      .filter((_, i) => selectedMessages.has(i))
      .map(({ id }) => id),
    diagnostics: {
      inputCharacters: promptSize(),
      omittedMessages: history.length - selectedMessages.size,
      omittedObservations: observations.length - selectedObservations.length,
      contextBudgetCharacters: budget,
    },
  };
}
