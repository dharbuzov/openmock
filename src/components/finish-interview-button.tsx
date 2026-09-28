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
  const { interview, setInterview } = useInterviewSession();
  const { problem, messages } = interview;
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
      const { finishInterview } = await import("@/lib/interview/engine");
      const workspaceSnapshot = problem.type === "system-design"
        ? { kind: "system-design" as const, architectureDiagram: captureCurrentArchitecture() }
        : { kind: "dsa" as const, code: code.current ? { ...code.current } : undefined };
      const finished = await finishInterview(settings, interview, workspaceSnapshot, request.signal);
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
