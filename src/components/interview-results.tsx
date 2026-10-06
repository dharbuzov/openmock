"use client";

import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { useMemo, useSyncExternalStore } from "react";
import type {
  CompetencyRating,
  EvaluationEvidence,
  HiringRecommendation,
} from "@/lib/interview/types";
import {
  parseResultsRecord,
  readResultsRecordValue,
  type ResultsRecord,
} from "@/lib/interview/evaluation-storage";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { buttonVariants } from "@/components/ui/button";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

const recommendationLabels: Record<HiringRecommendation, string> = {
  "strong-hire": "Strong Hire",
  hire: "Hire",
  mixed: "Mixed",
  "no-hire": "No Hire",
  "strong-no-hire": "Strong No Hire",
};
const ratingLabels: Record<CompetencyRating, string> = {
  "strong-positive": "Strong positive",
  positive: "Positive",
  mixed: "Mixed",
  negative: "Negative",
  "strong-negative": "Strong negative",
  "not-demonstrated": "Not demonstrated",
  "not-assessed": "Not assessed",
};

const recommendationVariants: Record<
  HiringRecommendation,
  "success" | "warning" | "destructive"
> = {
  "strong-hire": "success",
  hire: "success",
  mixed: "warning",
  "no-hire": "destructive",
  "strong-no-hire": "destructive",
};
const ratingVariants: Record<
  CompetencyRating,
  "success" | "warning" | "destructive" | "secondary"
> = {
  "strong-positive": "success",
  positive: "success",
  mixed: "warning",
  negative: "destructive",
  "strong-negative": "destructive",
  "not-demonstrated": "destructive",
  "not-assessed": "secondary",
};

function EvidenceList({ evidence }: { evidence: EvaluationEvidence[] }) {
  if (!evidence.length) return null;
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5 text-xs leading-5 text-muted-foreground">
      {evidence.map((item, index) => (
        <li key={index}>
          <p>{item.observation}</p>
          {item.stage ? (
            <p className="text-xs text-muted-foreground">{item.stage}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function ResultsScorecard({
  record,
  interviewId,
}: {
  record: ResultsRecord;
  interviewId: string;
}) {
  const { context, evaluation } = record;
  const elapsed = context.completedAt
    ? Date.parse(context.completedAt) - Date.parse(context.startedAt)
    : null;
  const minutes = elapsed === null ? 0 : Math.round(elapsed / 60_000);
  const duration =
    elapsed !== null && elapsed < 60_000
      ? "Less than 1 min"
      : minutes < 60
        ? `${minutes} min`
        : `${Math.floor(minutes / 60)} hr${minutes % 60 ? ` ${minutes % 60} min` : ""}`;
  const result = evaluation.status === "completed" ? evaluation.result : null;
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight">
            {context.problemTitle}
          </h2>
          <Link href="/practice" className={buttonVariants({ size: "sm" })}>
            Try another problem
            <ArrowRight data-icon="inline-end" aria-hidden="true" />
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{context.definitionName}</Badge>
          <Badge variant="outline">{context.levelName}</Badge>
          <Badge
            variant={
              context.endReason === "error" || context.endReason === "abandoned"
                ? "warning"
                : "success"
            }
          >
            {context.endReason === "error" || context.endReason === "abandoned"
              ? "Interrupted"
              : "Completed"}
          </Badge>
          {elapsed !== null && Number.isFinite(elapsed) && elapsed >= 0 ? (
            <Badge variant="outline">{duration}</Badge>
          ) : null}
          {evaluation.status !== "completed" ? (
            <Badge
              variant={
                evaluation.status === "failed" ? "destructive" : "warning"
              }
            >
              {evaluation.status === "failed"
                ? "Evaluation failed"
                : "Evaluation incomplete"}
            </Badge>
          ) : null}
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          Evidence-based feedback generated with your selected AI provider.
        </p>
      </header>
      <Separator />
      {result ? (
        <>
          <section
            aria-labelledby="recommendation"
            className="flex flex-col items-start gap-3"
          >
            <h2 id="recommendation" className="text-lg font-medium">
              Recommendation
            </h2>
            <Badge
              size="lg"
              variant={recommendationVariants[result.recommendation]}
            >
              {recommendationLabels[result.recommendation]}
            </Badge>
            <p className="max-w-prose text-sm leading-6 text-muted-foreground">
              {result.finalAssessment}
            </p>
          </section>
          <div className="grid gap-6 sm:grid-cols-2">
            {[
              { title: "What went well", items: result.strengths, Icon: Check },
              {
                title: "What to improve",
                items: result.concerns,
                Icon: ArrowRight,
              },
            ].map(({ title, items, Icon }) => (
              <section key={title} className="flex flex-col gap-3">
                <h2 className="text-sm font-medium">{title}</h2>
                {items.length ? (
                  <ul className="flex flex-col gap-2 text-sm leading-5 text-muted-foreground">
                    {items.map((item, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Icon
                          aria-hidden="true"
                          className="mt-0.5 size-4 shrink-0"
                        />
                        <span>{item.observation}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    None recorded.
                  </p>
                )}
              </section>
            ))}
          </div>
          <Separator />
          <section
            aria-labelledby="competencies"
            className="flex min-w-0 flex-col gap-3"
          >
            <h2 id="competencies" className="text-lg font-medium">
              Competencies
            </h2>
            <Accordion defaultValue={[]} multiple>
              {context.competencies.map(({ id, name }) => {
                const competency = result.competencies.find(
                  ({ competencyId }) => competencyId === id,
                );
                if (!competency) return null;
                return (
                  <AccordionItem key={id} value={id}>
                    <AccordionTrigger className="items-center gap-3 py-3">
                      <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                        <span className="min-w-0 break-words">{name}</span>
                        <span className="flex w-36 shrink-0 justify-start">
                          <Badge variant={ratingVariants[competency.rating]}>
                            {ratingLabels[competency.rating]}
                          </Badge>
                        </span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="flex max-w-prose flex-col gap-4 px-1 pt-1 pb-6 sm:px-3">
                        <p className="text-sm leading-6 text-muted-foreground">
                          {competency.summary}
                        </p>
                        {competency.expectation ? (
                          <div className="flex flex-col gap-1.5">
                            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              {result.targetLevel} expectation
                            </h3>
                            <p className="text-sm leading-5 text-muted-foreground">
                              {competency.expectation}
                            </p>
                          </div>
                        ) : null}
                        {competency.evidence.length ? (
                          <>
                            <h3 className="text-xs font-medium text-muted-foreground">
                              Evidence
                            </h3>
                            <EvidenceList evidence={competency.evidence} />
                          </>
                        ) : null}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </section>
        </>
      ) : (
        <section className="flex flex-col items-start gap-3">
          <h2 className="text-lg font-medium">
            No hiring recommendation available
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            {evaluation.status === "failed"
              ? evaluation.error.message
              : evaluation.status === "incomplete"
                ? evaluation.reason
                : ""}
          </p>
          {evaluation.status === "failed" ? (
            <Link
              href={`/interview/${interviewId}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Retry evaluation in interview room
            </Link>
          ) : null}
        </section>
      )}
    </div>
  );
}

export function InterviewResults({ interviewId }: { interviewId: string }) {
  const stored = useSyncExternalStore(
    () => () => undefined,
    () => readResultsRecordValue(interviewId),
    () => null,
  );
  const record = useMemo(() => parseResultsRecord(stored), [stored]);
  if (!record)
    return (
      <p className="text-sm leading-6 text-muted-foreground">
        No evaluation is available in this browser session.
      </p>
    );
  return <ResultsScorecard record={record} interviewId={interviewId} />;
}
