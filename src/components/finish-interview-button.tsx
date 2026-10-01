"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  useInterviewSession,
  useCaptureWorkspace,
} from "@/components/interview-session-context";
import { useOpenSettings } from "@/components/settings-provider";
import { readSettings } from "@/lib/settings/storage";
import { isCloudSettings } from "@/lib/settings/types";

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
  const pending = operation === "finish";
  const [error, setError] = useState("");
  async function finish() {
    if (operation || interview.status !== "in-progress") return;
    if (!messages.some((message) => message.role === "candidate")) {
      setError("Send at least one answer before finishing.");
      return;
    }

    const settings = readSettings();
    if ((isCloudSettings(settings) && !settings.apiKey) || !settings.model) {
      openSettings();
      return;
    }

    const request = beginOperation("finish");
    if (!request) return;
    setError("");
    try {
      const { finishInterview } = await import("@/lib/interview/engine");
      if (!isCurrentOperation(request)) return;
      const workspaceSnapshot = captureWorkspace();
      const finished = await finishInterview(
        settings,
        request.interview,
        problem,
        definition,
        workspaceSnapshot,
        request.controller.signal,
      );
      const { saveEvaluation } =
        await import("@/lib/interview/evaluation-storage");
      if (!isCurrentOperation(request)) return;
      saveEvaluation(finished.evaluation);
      commitOperation(request, finished.interview);
      router.push(`/results/${finished.interview.id}`);
    } catch {
      if (isCurrentOperation(request))
        setError("Evaluation failed. Check your AI settings and try again.");
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
        size="sm"
        variant="outline"
        disabled={operation !== null || interview.status !== "in-progress"}
        onClick={finish}
        title={error || undefined}
      >
        {pending ? "Evaluating…" : "Finish"}
      </Button>
    </div>
  );
}
