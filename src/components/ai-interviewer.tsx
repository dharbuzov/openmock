"use client";

import { useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useOpenSettings } from "@/components/settings-provider";
import {
  useInterviewSession,
  useCaptureWorkspace,
} from "@/components/interview-session-context";
import { readSettings } from "@/lib/settings/storage";
import { isCloudSettings } from "@/lib/settings/types";
import type { WorkspaceSnapshot } from "@/lib/interview/types";

export function AIInterviewer() {
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
  const [answer, setAnswer] = useState("");
  const pending = operation === "send";
  const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const lastWorkspaceSnapshot = useRef<WorkspaceSnapshot | null>(null);
  const openSettings = useOpenSettings();
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [messages, pending, error]);

  async function send(retry = false) {
    if (
      operation ||
      interview.status !== "in-progress" ||
      (!retry && !answer.trim())
    )
      return;
    const settings = readSettings();
    if ((isCloudSettings(settings) && !settings.apiKey) || !settings.model) {
      openSettings();
      return;
    }
    const request = beginOperation("send");
    if (!request) return;
    setError("");
    try {
      const { acceptCandidateMessage, processCandidateMessage } =
        await import("@/lib/interview/engine");
      if (!isCurrentOperation(request)) return;
      const next = retry
        ? request.interview
        : acceptCandidateMessage(request.interview, answer);
      if (!retry) lastWorkspaceSnapshot.current = captureWorkspace();
      const workspaceSnapshot = lastWorkspaceSnapshot.current ?? undefined;
      commitOperation(request, next);
      if (!retry) setAnswer("");
      const result = await processCandidateMessage(
        settings,
        next,
        problem,
        definition,
        workspaceSnapshot,
        request.controller.signal,
      );
      commitOperation(request, result);
    } catch {
      if (isCurrentOperation(request))
        setError(
          "Could not reach the interviewer. Check your AI settings and try again.",
        );
    } finally {
      endOperation(request);
    }
  }

  return (
    <section
      aria-labelledby="interviewer-heading"
      className="flex h-full min-h-0 flex-col"
    >
      <div className="flex h-11 shrink-0 items-center justify-between border-b px-4">
        <h2 id="interviewer-heading" className="text-xs font-medium">
          AI Interviewer
        </h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        {messages.length === 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-sm leading-6 text-muted-foreground">
              Begin by walking me through your initial approach, or introduce
              yourself.
            </p>
            <Button variant="outline" size="sm" onClick={openSettings}>
              Configure AI provider
            </Button>
          </div>
        )}
        <ol
          aria-label="Interview conversation"
          aria-live="polite"
          className="flex flex-col gap-7"
        >
          {messages.map((message) => (
            <li
              key={message.id}
              className={
                message.role === "candidate" ? "border-l-2 pl-3" : undefined
              }
            >
              <p className="mb-2 text-xs font-medium">
                {message.role === "candidate" ? "You" : "AI Interviewer"}
              </p>
              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
                {message.content}
              </p>
            </li>
          ))}
        </ol>
        {pending && (
          <p role="status" className="mt-4 text-xs text-muted-foreground">
            Interviewer is thinking…
          </p>
        )}
        {error && (
          <div className="mt-4 flex flex-col gap-3">
            <p role="alert" className="text-xs leading-5 text-muted-foreground">
              {error}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={
                  operation !== null || interview.status !== "in-progress"
                }
                onClick={() => send(true)}
              >
                Retry
              </Button>
              <Button size="sm" variant="ghost" onClick={openSettings}>
                AI settings
              </Button>
            </div>
          </div>
        )}
        <div ref={end} />
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
        className="flex shrink-0 flex-col gap-3 border-t p-4"
      >
        <label htmlFor="interview-answer" className="sr-only">
          Your answer
        </label>
        <Textarea
          id="interview-answer"
          name="answer"
          placeholder="Type your answer…"
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              void send();
            }
          }}
          aria-describedby="answer-note"
          className="max-h-36 min-h-24 resize-none"
        />
        <div className="flex items-center justify-between gap-2">
          <p
            id="answer-note"
            className="text-xs leading-5 text-muted-foreground"
          >
            Shift+Enter for a new line
          </p>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled
              aria-label="Microphone unavailable"
              title="Voice input is not available"
            >
              <Mic aria-hidden="true" />
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={
                operation !== null ||
                interview.status !== "in-progress" ||
                !answer.trim()
              }
            >
              Send
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}
