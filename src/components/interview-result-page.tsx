"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
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
  | { status: "failed" }
  | { status: "ready"; record: ResultsRecord };

function resultState(record: ResultsRecord): ResultState {
  return record.evaluation.status === "failed"
    ? { status: "failed" }
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
      () => {
        if (active) setState({ status: "failed" });
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
    } catch {
      setState({ status: "failed" });
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
        <h1 role="alert" className="text-xl font-semibold tracking-tight">
          We couldn&apos;t generate your evaluation.
        </h1>
        <Button variant="outline" onClick={retry}>
          Try again
        </Button>
      </main>
    );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">
        Interview results
      </h1>
      <ResultsScorecard record={state.record} interviewId={interviewId} />
      <div className="flex flex-wrap gap-3">
        <Link
          href="/practice"
          className={buttonVariants({ variant: "outline" })}
        >
          Choose another problem
        </Link>
      </div>
    </main>
  );
}
