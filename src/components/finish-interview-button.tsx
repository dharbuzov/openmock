"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useInterviewSession,
  useCaptureWorkspace,
} from "@/components/interview-session-context";
import { useOpenSettings } from "@/components/settings-provider";
import { readSettings } from "@/lib/settings/storage";
import { aiSettingsIssue } from "@/lib/settings/types";
import {
  readInterviewSession,
  saveInterviewSession,
} from "@/lib/interview/session-storage";
import type { Interview, WorkspaceSnapshot } from "@/lib/interview/types";

export function FinishInterviewButton() {
  const router = useRouter();
  const openSettings = useOpenSettings();
  const {
    interview,
    problem,
    definition,
    operation,
    beginOperation,
    commitOperation,
    endOperation,
    isCurrentOperation,
  } = useInterviewSession();
  const { messages } = interview;
  const captureWorkspace = useCaptureWorkspace();
  const pending = operation === "finish" || operation === "evaluate";
  const retry = interview.status === "completed";
  const evaluationWorkspace = useRef<WorkspaceSnapshot | undefined>(undefined);
  const [error, setError] = useState("");
  async function finish() {
    if (operation) return;
    if (!retry && !messages.some((message) => message.role === "candidate")) {
      setError("Send at least one answer before finishing.");
      return;
    }

    const settings = readSettings();
    if (retry && aiSettingsIssue(settings)) {
      openSettings();
      return;
    }

    const request = beginOperation(retry ? "evaluate" : "finish");
    if (!request) return;
    setError("");
    try {
      const { finishInterview, retryEvaluation } =
        await import("@/lib/interview/runner");
      if (!isCurrentOperation(request)) return;
      const session = readInterviewSession(request.interview.id);
      const workspaceSnapshot = retry
        ? (evaluationWorkspace.current ?? session?.evaluationWorkspace)
        : captureWorkspace();
      evaluationWorkspace.current = workspaceSnapshot;
      const preserveCompletion = (completed: Interview) => {
        commitOperation(request, completed);
        saveInterviewSession({
          interview: completed,
          interactionMode: session?.interactionMode ?? "chat",
          evaluationWorkspace: workspaceSnapshot,
        });
      };
      const run = retry ? retryEvaluation : finishInterview;
      const finished = await run(
        settings,
        request.interview,
        problem,
        definition,
        workspaceSnapshot,
        request.controller.signal,
        preserveCompletion,
      );
      if (!isCurrentOperation(request)) return;
      if (retry) preserveCompletion(finished.interview);
      if (finished.evaluation.status === "failed") {
        setError(finished.evaluation.error.message);
        return;
      }
      const { saveEvaluation } =
        await import("@/lib/interview/evaluation-storage");
      if (!isCurrentOperation(request)) return;
      saveEvaluation(finished.evaluation.result);
      router.push(`/results/${finished.interview.id}`);
    } catch {
      if (isCurrentOperation(request))
        setError(
          "Could not save the evaluation. Retry evaluation or check browser storage permissions.",
        );
    } finally {
      endOperation(request);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {error ? (
        <span
          role="alert"
          className="hidden max-w-64 text-right text-xs text-muted-foreground lg:inline"
        >
          {error}
        </span>
      ) : null}
      <Button
        size="icon-sm"
        className="sm:w-auto sm:px-2.5"
        aria-label={
          pending
            ? "Evaluating interview"
            : retry
              ? "Retry evaluation"
              : "Finish interview"
        }
        variant="outline"
        disabled={operation !== null}
        onClick={finish}
        title={error || undefined}
      >
        <Check aria-hidden="true" className="sm:hidden" />
        <span className="hidden sm:inline">
          {pending ? "Evaluating…" : retry ? "Retry evaluation" : "Finish"}
        </span>
      </Button>
    </div>
  );
}
