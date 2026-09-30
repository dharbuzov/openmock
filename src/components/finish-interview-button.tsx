"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useInterviewCode } from "@/components/interview-code-context";
import { useInterviewSession } from "@/components/interview-session-context";
import { useInterviewDiagram } from "@/components/interview-diagram-context";
import { useOpenSettings } from "@/components/settings-provider";
import { readSettings } from "@/lib/settings/storage";
import { isCloudSettings } from "@/lib/settings/types";

export function FinishInterviewButton() {
  const router = useRouter();
  const openSettings = useOpenSettings();
  const code = useInterviewCode();
  const { interview, setInterview, problem, definition } = useInterviewSession();
  const { messages } = interview;
  const { captureCurrentArchitecture } = useInterviewDiagram();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  async function finish() {
    if (controller.current) return;
    if (!messages.some((message) => message.role === "candidate")) {
      setError("Send at least one answer before finishing.");
      return;
    }

    const settings = readSettings();
    if ((isCloudSettings(settings) && !settings.apiKey) || !settings.model) {
      openSettings();
      return;
    }

    const request = new AbortController();
    controller.current = request;
    setPending(true);
    setError("");
    try {
      const { finishInterview } = await import("@/lib/interview/engine");
      const workspaceSnapshot = definition.workspace === "diagram"
        ? { type: "diagram" as const, diagram: captureCurrentArchitecture() }
        : definition.workspace === "code"
          ? { type: "code" as const, ...(code.current ?? { language: "text", filename: "solution.txt", code: "" }) }
          : definition.workspace === "project"
            ? { type: "project" as const, files: [] }
            : { type: "none" as const };
      const finished = await finishInterview(settings, interview, problem, definition, workspaceSnapshot, request.signal);
      const { saveEvaluation } = await import("@/lib/interview/evaluation-storage");
      saveEvaluation(finished.evaluation);
      setInterview(finished.interview);
      router.push(`/results/${finished.interview.id}`);
    } catch {
      if (!request.signal.aborted) setError("Evaluation failed. Check your AI settings and try again.");
    } finally {
      controller.current = null;
      if (!request.signal.aborted) setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {error ? <span role="alert" className="hidden max-w-64 text-right text-xs text-muted-foreground lg:inline">{error}</span> : null}
      <Button size="sm" variant="outline" disabled={pending} onClick={finish} title={error || undefined}>
        {pending ? "Evaluating…" : "Finish"}
      </Button>
    </div>
  );
}
