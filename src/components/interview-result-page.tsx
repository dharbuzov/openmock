"use client";

import { AlertCircle, ChevronRight } from "lucide-react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  evaluationFailure,
  type EvaluationFailure,
} from "@/lib/interview/evaluation-error";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ResultsScorecard } from "./interview-results";
import {
  parseResultsRecord,
  readResultsRecordValue,
  type ResultsRecord,
} from "@/lib/interview/evaluation-storage";
import { evaluateCompletedSession } from "@/lib/interview/evaluation-task";

type ResultState =
  | { status: "loading" }
  | { status: "failed"; error: EvaluationFailure }
  | { status: "ready"; record: ResultsRecord };

function resultState(record: ResultsRecord): ResultState {
  return record.evaluation.status === "failed"
    ? { status: "failed", error: record.evaluation.error }
    : { status: "ready", record };
}

export function InterviewResultPage({ interviewId }: { interviewId: string }) {
  const [state, setState] = useState<ResultState>({ status: "loading" });
  const retrying = useRef(false);

  useEffect(() => {
    let active = true;
    const stored = parseResultsRecord(readResultsRecordValue(interviewId));
    const task = stored
      ? Promise.resolve(stored)
      : evaluateCompletedSession(interviewId);
    task.then(
      (record) => {
        if (active) setState(resultState(record));
      },
      (error) => {
        if (active)
          setState({ status: "failed", error: evaluationFailure(error) });
      },
    );
    // Evaluation persists its result even when the user leaves this page.
    return () => {
      active = false;
    };
  }, [interviewId]);

  async function retry() {
    if (retrying.current) return;
    retrying.current = true;
    setState({ status: "loading" });
    try {
      setState(resultState(await evaluateCompletedSession(interviewId)));
    } catch (error) {
      setState({ status: "failed", error: evaluationFailure(error) });
    } finally {
      retrying.current = false;
    }
  }

  if (state.status === "loading")
    return (
      <main
        className="flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center gap-4 px-6 text-center"
        role="status"
        aria-live="polite"
      >
        <Spinner aria-hidden="true" className="text-muted-foreground" />
        <h1 className="text-xl font-semibold tracking-tight">
          Evaluating your interview
        </h1>
        <p className="max-w-md text-sm leading-6 text-muted-foreground">
          Reviewing your answers, reasoning, and overall performance. This may
          take a moment.
        </p>
      </main>
    );

  if (state.status === "failed")
    return (
      <main className="flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center gap-4 px-6 text-center">
        <AlertCircle
          aria-hidden="true"
          className="size-6 text-muted-foreground"
        />
        <h1 className="text-xl font-semibold tracking-tight">
          Evaluation failed
        </h1>
        <p
          role="alert"
          className="max-w-md text-sm leading-6 text-muted-foreground"
        >
          {state.error.message}
        </p>
        <Button variant="outline" onClick={retry}>
          Try again
        </Button>
        <Collapsible defaultOpen={false} className="w-full max-w-md text-left">
          <CollapsibleTrigger className="group flex items-center gap-2 rounded-sm py-2 text-sm text-muted-foreground focus-visible:outline-ring">
            <ChevronRight
              aria-hidden="true"
              className="size-4 group-data-[panel-open]:rotate-90"
            />
            Technical details
          </CollapsibleTrigger>
          <CollapsibleContent>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 rounded-md border bg-muted/30 p-3 font-mono text-xs leading-5">
              {[
                ["Provider", state.error.provider],
                ["Model", state.error.model],
                ["Error", state.error.error],
                ["Details", state.error.details],
                ["Request ID", state.error.requestId],
              ].map(([label, value]) =>
                value ? (
                  <div key={label} className="contents">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="whitespace-pre-wrap break-words">{value}</dd>
                  </div>
                ) : null,
              )}
            </dl>
          </CollapsibleContent>
        </Collapsible>
      </main>
    );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">
        Interview results
      </h1>
      <ResultsScorecard record={state.record} interviewId={interviewId} />
    </main>
  );
}
