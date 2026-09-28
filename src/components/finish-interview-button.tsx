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
import type { Problem } from "@/lib/problems/types";

export function FinishInterviewButton({ interviewId, problem }: { interviewId: string; problem: Problem }) {
  const router = useRouter();
  const openSettings = useOpenSettings();
  const code = useInterviewCode();
  const { messages, systemDesignState } = useInterviewSession();
  const { captureCurrentArchitecture } = useInterviewDiagram();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  async function finish() {
    if (controller.current) return;
    if (!messages.some((message) => message.role === "user")) {
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
      const [{ evaluateInterview }, { saveEvaluation }] = await Promise.all([
        import("@/lib/ai/evaluation"),
        import("@/lib/interview/evaluation-storage"),
      ]);
      const codeSnapshot = problem.type === "dsa" && code.current ? { ...code.current } : undefined;
      const evaluation = await evaluateInterview(settings, {
        problem,
        messages,
        code: codeSnapshot,
        systemDesignState: systemDesignState ?? undefined,
        architectureDiagram: problem.type === "system-design" ? captureCurrentArchitecture() : undefined,
      }, request.signal);
      saveEvaluation(interviewId, evaluation);
      router.push(`/results/${interviewId}`);
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
