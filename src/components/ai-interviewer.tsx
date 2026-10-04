"use client";

import { CurrentStageBadge } from "./current-stage-badge";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mic, Square, ArrowDown, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
  useMessageScroller,
} from "@/components/ui/message-scroller";
import { acceptCandidateMessage } from "@/lib/interview/engine";
import { cn } from "cn";
import { Textarea } from "@/components/ui/textarea";
import { useOpenSettings } from "@/components/settings-provider";
import {
  useInterviewSession,
  useCaptureWorkspace,
} from "@/components/interview-session-context";
import { readSettings, subscribeSettings } from "@/lib/settings/storage";
import { aiSettingsIssue } from "@/lib/settings/types";
import type { WorkspaceSnapshot } from "@/lib/interview/types";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useInterviewControls } from "./interview-controls-context";
import { useInterviewVoice } from "./use-interview-voice";

const providerIssueSnapshot = () => aiSettingsIssue(readSettings());
const serverProviderIssueSnapshot = () => "";

function FollowSubmittedAnswer({ messageId }: { messageId?: string }) {
  const { scrollToEnd } = useMessageScroller();
  useEffect(() => {
    if (messageId) scrollToEnd({ behavior: "auto" });
  }, [messageId, scrollToEnd]);
  return null;
}

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
  const [streamedResponse, setStreamedResponse] = useState("");
  const lastWorkspaceSnapshot = useRef<WorkspaceSnapshot | null>(null);
  const openSettings = useOpenSettings();
  const providerIssue = useSyncExternalStore(
    subscribeSettings,
    providerIssueSnapshot,
    serverProviderIssueSnapshot,
  );
  const {
    mode,
    setMode,
    voiceEnabled,
    setVoiceEnabled,
    speechAvailable,
    playbackAvailable,
  } = useInterviewControls();
  const voice = useInterviewVoice({
    messages,
    busy: operation !== null,
    finishing: operation === "finish" || operation === "evaluate",
    active: interview.status === "in-progress" && !error,
    onDictation: (text) =>
      setAnswer((previous) =>
        [previous.trim(), text].filter(Boolean).join(" "),
      ),
  });
  const state = pending
    ? messages.at(-1)?.role !== "candidate"
      ? "submitting"
      : streamedResponse
        ? "interviewer-streaming"
        : "interviewer-thinking"
    : voice.transcribing
      ? "transcribing"
      : voice.listening
        ? "user-listening"
        : error || voice.error
          ? "error"
          : voice.speaking
            ? "interviewer-speaking"
            : answer.trim()
              ? "user-typing"
              : "idle";
  const inputBlocked =
    operation !== null ||
    voice.transcribing ||
    interview.status !== "in-progress" ||
    interview.stage.current === null;
  const lastCandidate =
    messages.at(-1)?.role === "candidate" ? messages.at(-1) : undefined;
  const transcriptMessages = messages.map((message, index) => ({
    message,
    key:
      message.role === "interviewer"
        ? `response-${messages[index - 1]?.id ?? message.id}`
        : message.id,
    pending: false,
  }));
  if (pending && lastCandidate)
    transcriptMessages.push({
      message: {
        ...lastCandidate,
        role: "interviewer",
        content: streamedResponse,
      },
      key: `response-${lastCandidate.id}`,
      pending: true,
    });
  const draft =
    voice.listening || voice.transcribing
      ? [answer.trim(), voice.partialTranscript].filter(Boolean).join(" ")
      : answer;

  async function send(retry = false) {
    const candidateAnswer = answer;
    if (
      operation ||
      voice.transcribing ||
      voice.listening ||
      (error && !retry) ||
      interview.status !== "in-progress" ||
      interview.stage.current === null ||
      (!retry && !candidateAnswer.trim())
    )
      return;
    const settings = readSettings();
    if (aiSettingsIssue(settings)) {
      if (mode === "live") setMode("chat");
      openSettings();
      return;
    }
    const request = beginOperation("send");
    if (!request) return;
    setError("");
    setStreamedResponse("");
    const speech = voice.beginResponse(request.controller.signal);
    try {
      if (!isCurrentOperation(request)) return;
      const next = retry
        ? request.interview
        : acceptCandidateMessage(request.interview, candidateAnswer);
      commitOperation(request, next);
      if (!retry || !lastWorkspaceSnapshot.current)
        lastWorkspaceSnapshot.current = captureWorkspace();
      const workspaceSnapshot = lastWorkspaceSnapshot.current ?? undefined;
      const { processCandidateMessage } =
        await import("@/lib/interview/runner");
      if (!isCurrentOperation(request)) return;
      const result = await processCandidateMessage(
        settings,
        next,
        problem,
        definition,
        workspaceSnapshot,
        request.controller.signal,
        (content) => {
          if (isCurrentOperation(request)) {
            setStreamedResponse(content);
            speech.push(content);
          }
        },
      );
      if (commitOperation(request, result)) {
        const response = result.messages.at(-1);
        if (response?.role === "interviewer") speech.finish(response);
        setAnswer("");
        setStreamedResponse("");
      }
    } catch {
      speech.cancel();
      if (isCurrentOperation(request)) {
        setStreamedResponse("");
        setError("Couldn’t get a response from the AI provider.");
      }
    } finally {
      endOperation(request);
    }
  }

  return (
    <section
      aria-labelledby="interviewer-heading"
      data-conversation-state={state}
      className="flex h-full min-h-0 flex-col"
    >
      <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b px-4">
        <h2 id="interviewer-heading" className="shrink-0 text-xs font-medium">
          AI Interviewer
        </h2>
        <div className="flex min-w-0 items-center gap-1.5">
          <CurrentStageBadge numbered />
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={
                    voiceEnabled
                      ? "Disable interviewer voice"
                      : "Enable interviewer voice"
                  }
                  aria-pressed={voiceEnabled}
                  disabled={!playbackAvailable}
                  onClick={() => setVoiceEnabled(!voiceEnabled)}
                />
              }
            >
              {voiceEnabled ? (
                <Volume2 aria-hidden="true" />
              ) : (
                <VolumeX aria-hidden="true" />
              )}
            </TooltipTrigger>
            <TooltipContent>
              {playbackAvailable
                ? voiceEnabled
                  ? "Disable interviewer voice"
                  : "Enable interviewer voice"
                : "Voice playback is unavailable in this browser"}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
      <MessageScrollerProvider autoScroll defaultScrollPosition="end">
        <MessageScroller className="min-h-0 flex-1">
          <MessageScrollerViewport
            aria-label="Interview conversation"
            className="p-4"
          >
            <MessageScrollerContent
              className="gap-7"
              aria-live="polite"
              aria-relevant="additions"
              role="log"
            >
              {messages.length === 0 && (
                <MessageScrollerItem messageId="intro">
                  {providerIssue ? (
                    <Empty className="items-start justify-start gap-3 rounded-none p-0 text-left">
                      <EmptyHeader className="items-start gap-1">
                        <EmptyTitle>AI provider not configured</EmptyTitle>
                        <EmptyDescription>
                          Connect a provider to start the interview.
                        </EmptyDescription>
                      </EmptyHeader>
                      <EmptyContent className="items-start">
                        <Button size="sm" onClick={openSettings}>
                          Configure provider
                        </Button>
                      </EmptyContent>
                    </Empty>
                  ) : (
                    <p className="text-sm leading-6 text-muted-foreground">
                      Begin by walking me through your initial approach, or
                      introduce yourself.
                    </p>
                  )}
                </MessageScrollerItem>
              )}
              {transcriptMessages.map(
                ({ message, key, pending: isPending }) => (
                  <MessageScrollerItem
                    messageId={key}
                    key={key}
                    className={
                      message.role === "candidate"
                        ? "border-l-2 pl-3"
                        : undefined
                    }
                  >
                    <p className="mb-2 text-xs font-medium">
                      {message.role === "candidate" ? "You" : "Interviewer"}
                    </p>
                    <p className="min-h-6 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
                      {isPending && !message.content ? (
                        <span
                          role="status"
                          className="motion-safe:animate-pulse"
                        >
                          Thinking…
                        </span>
                      ) : (
                        message.content
                      )}
                    </p>
                  </MessageScrollerItem>
                ),
              )}
              {error && (
                <MessageScrollerItem
                  messageId="provider-error"
                  className="flex flex-col gap-3"
                >
                  <p
                    role="alert"
                    className="text-xs leading-5 text-muted-foreground"
                  >
                    {error}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        operation !== null ||
                        interview.status !== "in-progress" ||
                        interview.stage.current === null
                      }
                      onClick={() => send(true)}
                    >
                      Retry
                    </Button>
                    <Button size="sm" variant="ghost" onClick={openSettings}>
                      AI settings
                    </Button>
                  </div>
                </MessageScrollerItem>
              )}
              {voice.error && (
                <MessageScrollerItem
                  messageId="voice-error"
                  className="flex flex-col items-start gap-2"
                >
                  <p role="alert" className="text-xs text-muted-foreground">
                    {voice.error}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={voice.retry}
                    disabled={inputBlocked}
                  >
                    {voice.failedOperation === "playback"
                      ? "Retry audio"
                      : "Retry microphone"}
                  </Button>
                </MessageScrollerItem>
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <FollowSubmittedAnswer
            messageId={
              messages.findLast((message) => message.role === "candidate")?.id
            }
          />
          <MessageScrollerButton
            size="sm"
            behavior="auto"
            className="gap-1.5"
            aria-label="Go to latest message"
          >
            <ArrowDown data-icon="inline-start" aria-hidden="true" /> New
            message
          </MessageScrollerButton>
        </MessageScroller>
      </MessageScrollerProvider>
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
        {(voice.listening || voice.transcribing) && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 text-xs text-muted-foreground"
          >
            {voice.listening && (
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-success"
              />
            )}
            <span>{voice.transcribing ? "Transcribing…" : "Recording…"}</span>
            {voice.listening && (
              <span className="ml-auto font-mono tabular-nums">
                {String(Math.floor(voice.recordingSeconds / 60)).padStart(
                  2,
                  "0",
                )}
                :{String(voice.recordingSeconds % 60).padStart(2, "0")}
              </span>
            )}
          </div>
        )}
        <Textarea
          id="interview-answer"
          name="answer"
          placeholder={
            voice.listening ? "Speak your answer…" : "Type your answer…"
          }
          value={draft}
          disabled={inputBlocked}
          readOnly={voice.listening}
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
          className={cn(
            "max-h-36 min-h-24 resize-none",
            voice.listening && "border-success/30 bg-muted/30",
          )}
        />
        <div className="flex items-center justify-between gap-2">
          <p
            id="answer-note"
            className="text-xs leading-5 text-muted-foreground"
          >
            {voice.speaking
              ? "Interviewer speaking"
              : "Shift+Enter for a new line"}
          </p>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size={voice.listening ? "sm" : "icon-sm"}
              disabled={!speechAvailable || inputBlocked || voice.speaking}
              aria-label={voice.listening ? "Stop recording" : "Dictate answer"}
              aria-pressed={voice.listening}
              title={
                speechAvailable
                  ? voice.listening
                    ? "Stop microphone"
                    : "Dictate answer"
                  : "Microphone recording is unavailable in this browser"
              }
              onClick={voice.toggleMicrophone}
            >
              {voice.listening ? (
                <>
                  <Square aria-hidden="true" data-icon="inline-start" />
                  Stop
                </>
              ) : (
                <Mic aria-hidden="true" />
              )}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={
                inputBlocked ||
                voice.listening ||
                Boolean(error) ||
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
