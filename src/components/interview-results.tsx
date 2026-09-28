"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { InterviewEvaluation } from "@/lib/ai/evaluation";
import { parseEvaluation, readEvaluationValue } from "@/lib/interview/evaluation-storage";

const signalLabels: Record<InterviewEvaluation["hiringSignal"], string> = {
  "strong-no": "Strong no",
  no: "No",
  mixed: "Mixed",
  yes: "Yes",
  "strong-yes": "Strong yes",
};

const categoryLabels: Record<keyof InterviewEvaluation["categories"], string> = {
  problemSolving: "Problem solving",
  communication: "Communication",
  technicalDepth: "Technical depth",
  tradeoffs: "Trade-offs",
};

export function InterviewResults({ interviewId }: { interviewId: string }) {
  const stored = useSyncExternalStore(
    () => () => undefined,
    () => readEvaluationValue(interviewId),
    () => null,
  );
  const evaluation = useMemo(() => parseEvaluation(stored), [stored]);

  if (evaluation === null) {
    return <p className="text-sm leading-6 text-muted-foreground">No evaluation is available in this browser session. Reopen the interview, answer the interviewer, and use Finish to generate feedback.</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="evaluation-summary" className="flex flex-col gap-4">
        <div className="grid grid-cols-2 border-y py-5 sm:grid-cols-4">
          <div className="flex flex-col gap-1 border-r px-4 first:pl-0">
            <span className="text-xs text-muted-foreground">Score</span>
            <span className="font-mono text-2xl font-semibold tabular-nums">{evaluation.overallScore}<span className="text-sm font-normal text-muted-foreground">/100</span></span>
          </div>
          <div className="flex flex-col gap-1 px-4">
            <span className="text-xs text-muted-foreground">Signal</span>
            <span className="text-sm font-medium">{signalLabels[evaluation.hiringSignal]}</span>
          </div>
        </div>
        <h2 id="evaluation-summary" className="text-lg font-medium">Summary</h2>
        <p className="text-sm leading-6 text-muted-foreground">{evaluation.summary}</p>
      </section>

      <section aria-labelledby="category-scores" className="flex flex-col gap-4">
        <h2 id="category-scores" className="text-lg font-medium">Evidence by category</h2>
        <div className="border-y">
          {Object.entries(evaluation.categories).map(([key, category], index) => (
            <article key={key} className={index > 0 ? "border-t py-5" : "py-5"}>
              <div className="mb-3 flex items-baseline justify-between gap-4">
                <h3 className="text-sm font-medium">{categoryLabels[key as keyof typeof categoryLabels]}</h3>
                <span className="font-mono text-sm tabular-nums">{category.score}/5</span>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">{category.summary}</p>
              <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-xs leading-5 text-muted-foreground">
                {category.evidence.map((item) => (
                  <li key={`${item.source}:${item.sourceIndex}:${item.observation}`}>
                    <span className="font-mono">{item.source === "code" ? "Code" : `Answer ${item.sourceIndex + 1}`}</span>
                    {": "}{item.observation}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <div className="grid gap-8 sm:grid-cols-2">
        <section aria-labelledby="strengths" className="flex flex-col gap-3">
          <h2 id="strengths" className="text-lg font-medium">Strengths</h2>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-6 text-muted-foreground">
            {evaluation.strengths.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>
        <section aria-labelledby="improvements" className="flex flex-col gap-3">
          <h2 id="improvements" className="text-lg font-medium">Next improvements</h2>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-6 text-muted-foreground">
            {evaluation.improvements.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>
      </div>

      {evaluation.insufficientEvidence.length > 0 ? (
        <section aria-labelledby="evidence-gaps" className="flex flex-col gap-3 border-t pt-6">
          <h2 id="evidence-gaps" className="text-lg font-medium">Evidence gaps</h2>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-6 text-muted-foreground">
            {evaluation.insufficientEvidence.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
