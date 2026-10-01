"use client";

import { useMemo, useSyncExternalStore } from "react";
import type {
  CompetencyRating,
  EvaluationEvidence,
  HiringRecommendation,
} from "@/lib/interview/types";
import {
  parseEvaluation,
  readEvaluationValue,
} from "@/lib/interview/evaluation-storage";

const recommendationLabels: Record<HiringRecommendation, string> = {
  "strong-hire": "Strong hire",
  hire: "Hire",
  mixed: "Mixed",
  "no-hire": "No hire",
  "strong-no-hire": "Strong no hire",
};
const ratingLabels: Record<CompetencyRating, string> = {
  "strong-positive": "Strong positive",
  positive: "Positive",
  mixed: "Mixed",
  negative: "Negative",
  "strong-negative": "Strong negative",
  "not-assessed": "Not assessed",
};

function EvidenceList({ evidence }: { evidence: EvaluationEvidence[] }) {
  if (evidence.length === 0)
    return (
      <p className="text-xs text-muted-foreground">No evidence recorded.</p>
    );
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5 text-xs leading-5 text-muted-foreground">
      {evidence.map((item, index) => (
        <li
          key={`${item.messageId ?? item.stage ?? index}:${item.observation}`}
        >
          {item.messageId ? (
            <span className="font-mono">
              Message {item.messageId.slice(0, 8)}:{" "}
            </span>
          ) : null}
          {item.observation}
        </li>
      ))}
    </ul>
  );
}

export function InterviewResults({ interviewId }: { interviewId: string }) {
  const stored = useSyncExternalStore(
    () => () => undefined,
    () => readEvaluationValue(interviewId),
    () => null,
  );
  const evaluation = useMemo(() => parseEvaluation(stored), [stored]);
  if (!evaluation)
    return (
      <p className="text-sm leading-6 text-muted-foreground">
        No evaluation is available in this browser session.
      </p>
    );

  return (
    <div className="flex flex-col gap-8">
      <section
        aria-labelledby="evaluation-summary"
        className="flex flex-col gap-4"
      >
        <div className="flex border-y py-5">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              Recommendation
            </span>
            <span className="text-sm font-medium">
              {recommendationLabels[evaluation.recommendation]}
            </span>
          </div>
        </div>
        <h2 id="evaluation-summary" className="text-lg font-medium">
          Summary
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          {evaluation.summary}
        </p>
        <p className="text-sm leading-6">{evaluation.finalAssessment}</p>
      </section>

      <section aria-labelledby="competencies" className="flex flex-col gap-4">
        <h2 id="competencies" className="text-lg font-medium">
          Competencies
        </h2>
        <div className="border-y">
          {evaluation.competencies.map((competency, index) => (
            <article
              key={competency.competencyId}
              className={index ? "border-t py-5" : "py-5"}
            >
              <div className="mb-3 flex items-baseline justify-between gap-4">
                <h3 className="text-sm font-medium">
                  {competency.competencyId}
                </h3>
                <span className="text-sm text-muted-foreground">
                  {ratingLabels[competency.rating]}
                </span>
              </div>
              <p className="mb-3 text-sm leading-6 text-muted-foreground">
                {competency.summary}
              </p>
              <EvidenceList evidence={competency.evidence} />
            </article>
          ))}
        </div>
      </section>

      <div className="grid gap-8 sm:grid-cols-2">
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">Strengths</h2>
          <EvidenceList evidence={evaluation.strengths} />
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">Concerns</h2>
          <EvidenceList evidence={evaluation.concerns} />
        </section>
      </div>
      {evaluation.keyMoments.length ? (
        <section className="flex flex-col gap-3 border-t pt-6">
          <h2 className="text-lg font-medium">Key moments</h2>
          <EvidenceList evidence={evaluation.keyMoments} />
        </section>
      ) : null}
    </div>
  );
}
