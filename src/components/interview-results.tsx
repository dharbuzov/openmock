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

const categoryLabels: Record<string, string> = {
  problemSolving: "Problem solving",
  communication: "Communication",
  technicalDepth: "Technical depth",
  tradeoffs: "Trade-offs",
  requirementsAndScope: "Requirements & scope",
  architecture: "Architecture",
  dataAndState: "Data & state",
  scalability: "Scalability",
  reliability: "Reliability",
};

const levelLabels = {
  "needs-improvement": "Needs improvement",
  developing: "Developing",
  strong: "Strong",
  "very-strong": "Very strong",
} as const;

type ResultEvidence = {
  source: "candidate-message" | "code" | "diagram";
  sourceIndex: number;
  observation: string;
};

type ResultCategory = {
  summary: string;
  evidence: ResultEvidence[];
  score?: number;
  level?: keyof typeof levelLabels;
};

function evidenceLabel(source: "candidate-message" | "code" | "diagram", sourceIndex: number): string {
  if (source === "code") return "Code";
  if (source === "diagram") return "Architecture diagram";
  return `Answer ${sourceIndex + 1}`;
}

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
        <div className="flex border-y py-5">
          {evaluation.interviewType === "dsa" ? <div className="flex min-w-40 flex-col gap-1 border-r pr-6">
            <span className="text-xs text-muted-foreground">Score</span>
            <span className="font-mono text-2xl font-semibold tabular-nums">{evaluation.overallScore}<span className="text-sm font-normal text-muted-foreground">/100</span></span>
          </div> : null}
          <div className="flex flex-col gap-1 px-6 first:pl-0">
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
          {(Object.entries(evaluation.categories) as [string, ResultCategory][]).map(([key, category], index) => (
            <article key={key} className={index > 0 ? "border-t py-5" : "py-5"}>
              <div className="mb-3 flex items-baseline justify-between gap-4">
                <h3 className="text-sm font-medium">{categoryLabels[key]}</h3>
                <span className="text-sm text-muted-foreground">{category.score !== undefined
                  ? `${category.score}/5`
                  : category.level ? levelLabels[category.level] : "—"}</span>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">{category.summary}</p>
              <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-xs leading-5 text-muted-foreground">
                {category.evidence.map((item) => (
                  <li key={`${item.source}:${item.sourceIndex}:${item.observation}`}>
                    <span className="font-mono">{evidenceLabel(item.source, item.sourceIndex)}</span>
                    {": "}{item.observation}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      {evaluation.interviewType === "system-design" ? (
        <section aria-labelledby="key-moments" className="flex flex-col gap-4">
          <h2 id="key-moments" className="text-lg font-medium">Key moments</h2>
          <div className="border-y">
            {evaluation.keyMoments.map((moment, index) => (
              <article key={`${moment.kind}:${moment.summary}`} className={index > 0 ? "border-t py-4" : "py-4"}>
                <p className="text-xs font-medium capitalize text-muted-foreground">{moment.kind === "tradeoff" ? "Trade-off" : moment.kind}</p>
                <p className="mt-1 text-sm leading-6">{moment.summary}</p>
                <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-xs leading-5 text-muted-foreground">
                  {moment.evidence.map((item) => (
                    <li key={`${item.source}:${item.sourceIndex}:${item.observation}`}>
                      <span className="font-mono">{evidenceLabel(item.source, item.sourceIndex)}</span>{": "}{item.observation}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      ) : null}

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
