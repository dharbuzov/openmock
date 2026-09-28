import { z } from "zod";
import type { Problem } from "../problems/types";

export const systemDesignPhases = [
  "clarification",
  "estimation",
  "high_level_design",
  "deep_dive",
  "reliability",
  "tradeoffs",
  "wrap_up",
] as const;

export type SystemDesignPhase = (typeof systemDesignPhases)[number];

const evidencedStatementSchema = z.object({
  statement: z.string().min(1).max(300),
  evidenceCandidateMessageIndex: z.number().int().min(0),
});

const decisionSchema = evidencedStatementSchema.extend({
  rationale: z.string().min(1).max(300).optional(),
});

export const systemDesignStateSchema = z.object({
  phase: z.enum(systemDesignPhases),
  coveredTopics: z.array(z.string().min(1).max(120)).max(30),
  establishedRequirements: z.array(evidencedStatementSchema).max(24),
  assumptions: z.array(evidencedStatementSchema).max(24),
  decisions: z.array(decisionSchema).max(24),
  unresolvedQuestions: z.array(z.string().min(1).max(240)).max(16),
  challengeAreas: z.array(z.string().min(1).max(240)).max(16),
  candidateSignal: z.enum(["struggling", "steady", "strong"]),
});

export const systemDesignTurnSchema = z.object({
  response: z.string().min(1).max(1_200),
  state: systemDesignStateSchema,
});

export type SystemDesignState = z.infer<typeof systemDesignStateSchema>;

export function createInitialSystemDesignState(): SystemDesignState {
  return {
    phase: "clarification",
    coveredTopics: [],
    establishedRequirements: [],
    assumptions: [],
    decisions: [],
    unresolvedQuestions: [],
    challengeAreas: [],
    candidateSignal: "steady",
  };
}

export function systemDesignOpening(problem: Pick<Problem, "title">): string {
  const subject = problem.title.replace(/^design\s+/i, "");
  return `Let's design ${subject}.\n\nBefore we get into the architecture, what requirements would you like to clarify?`;
}

function mergeByStatement<T extends { statement: string }>(previous: T[], next: T[], limit: number): T[] {
  const merged = new Map(previous.map((item) => [item.statement.trim().toLocaleLowerCase(), item]));
  for (const item of next) merged.set(item.statement.trim().toLocaleLowerCase(), item);
  return [...merged.values()].slice(-limit);
}

function mergeStrings(previous: string[], next: string[], limit: number): string[] {
  const merged = new Map<string, string>();
  for (const item of [...previous, ...next]) merged.set(item.trim().toLocaleLowerCase(), item.trim());
  return [...merged.values()].slice(-limit);
}

export function mergeSystemDesignState(
  previous: SystemDesignState,
  proposed: SystemDesignState,
  candidateMessageCount: number,
): SystemDesignState {
  const hasValidEvidence = (item: { evidenceCandidateMessageIndex: number }) => (
    item.evidenceCandidateMessageIndex < candidateMessageCount
  );

  return {
    phase: proposed.phase,
    coveredTopics: mergeStrings(previous.coveredTopics, proposed.coveredTopics, 30),
    establishedRequirements: mergeByStatement(
      previous.establishedRequirements,
      proposed.establishedRequirements.filter(hasValidEvidence),
      24,
    ),
    assumptions: mergeByStatement(
      previous.assumptions,
      proposed.assumptions.filter(hasValidEvidence),
      24,
    ),
    decisions: mergeByStatement(previous.decisions, proposed.decisions.filter(hasValidEvidence), 24),
    unresolvedQuestions: mergeStrings([], proposed.unresolvedQuestions, 16),
    challengeAreas: mergeStrings(previous.challengeAreas, proposed.challengeAreas, 16),
    candidateSignal: proposed.candidateSignal,
  };
}
