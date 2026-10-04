"use client";

import { CurrentStageBadge } from "./current-stage-badge";

import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Mic, ArrowDown, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
  useMessageScroller,
} from "@/components/ui/message-scroller";
import { saveInterviewSession } from "@/lib/interview/session-storage";
import { acceptCandidateMessage } from "@/lib/interview/engine";
import { Spinner } from "@/components/ui/spinner";
import { RecordingControls } from "./recording-controls";
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
import { logger } from "@/lib/logging/logger";

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
  const answerInput = useRef<HTMLTextAreaElement>(null);
  const composer = useRef<HTMLFormElement>(null);
  const [composerHeight, setComposerHeight] = useState(136);
  const opening = operation === "opening";
  const pending = opening || operation === "send";
  const [error, setError] = useState("");
  const [streamedResponse, setStreamedResponse] = useState("");
  const lastWorkspaceSnapshot = useRef<WorkspaceSnapshot | null>(null);
  const openSettings = useOpenSettings();
  const providerIssue = useSyncExternalStore(
    subscribeSettings,
    providerIssueSnapshot,
    serverProviderIssueSnapshot,
  );
  const { voiceEnabled, setVoiceEnabled, speechAvailable, playbackAvailable } =
    useInterviewControls();
  const voice = useInterviewVoice({
    messages,
    busy: operation !== null,
    finishing: operation === "finish" || operation === "evaluate",
    active: interview.status === "in-progress" && !error,
    onDictation: (text) =>
      setAnswer((previous) =>
        [previous.trim(), text].filter(Boolean).join(" "),
      ),
    onRecordedAnswer: (text) => {
      void send(false, [answer.trim(), text].filter(Boolean).join(" "), true);
    },
  });
  const previousRecordingState = useRef(voice.recordingState);
  useEffect(() => {
    if (
      voice.recordingState === "idle" &&
      previousRecordingState.current !== "idle"
    ) {
      answerInput.current?.focus();
    }
    previousRecordingState.current = voice.recordingState;
  }, [voice.recordingState]);
  const state = pending
    ? !opening && messages.at(-1)?.role !== "candidate"
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
    messages.length === 0 ||
    operation !== null ||
    voice.transcribing ||
    interview.status !== "in-progress" ||
    interview.stage.current === null;
  const microphoneShortcut = useSyncExternalStore(
    () => () => {},
    () =>
      typeof navigator !== "undefined" &&
      /Mac|iPhone|iPad/.test(navigator.platform)
        ? "⌘M"
        : "Ctrl+M",
    () => "Ctrl+M",
  );
  function startRecording() {
    if (!speechAvailable || inputBlocked || error) return;
    if (composer.current) setComposerHeight(composer.current.clientHeight - 32);
    voice.startRecording();
  }
  const cancelRecording = voice.cancelRecording;
  const stopAndReview = voice.stopAndReview;
  const stopAndSend = voice.stopAndSend;
  const hotkey = useEffectEvent((event: KeyboardEvent) => {
    if (
      !(event.ctrlKey || event.metaKey) ||
      (event.code !== "KeyM" && event.key.toLowerCase() !== "m")
    )
      return;
    // This listener belongs to the mounted interview room, including hidden panes.
    if (!document.querySelector("[data-interview-room]")) return;
    // Keep the browser shortcut from running, including during transcription.
    event.preventDefault();
    event.stopImmediatePropagation();
    const reason = event.altKey
      ? "alt-modifier"
      : event.isComposing
        ? "composing"
        : event.repeat
          ? "key-repeat"
          : voice.transcribing
            ? "transcribing"
            : operation
              ? "interview-busy"
              : interview.status !== "in-progress" ||
                  interview.stage.current === null
                ? "interview-inactive"
                : error
                  ? "provider-error"
                  : !speechAvailable
                    ? "microphone-unavailable"
                    : !voice.listening && voice.isRecordingPending()
                      ? "microphone-request-pending"
                      : null;
    const action = reason
      ? "ignore"
      : voice.listening
        ? "stop-and-review"
        : "start-recording";
    if (process.env.NODE_ENV !== "production")
      logger.debug(
        {
          key: event.key,
          code: event.code,
          recordingState: voice.recordingState,
          action,
          ignoredReason: reason,
        },
        "Microphone shortcut detected",
      );
    if (reason) return;
    if (action === "stop-and-review") stopAndReview();
    else startRecording();
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.addEventListener("keydown", hotkey, true);
    return () => window.removeEventListener("keydown", hotkey, true);
  }, []);
  const lastCandidate =
    messages.at(-1)?.role === "candidate" ? messages.at(-1) : undefined;
  const transcriptMessages = messages.map((message, index) => ({
    message,
    key:
      message.role === "interviewer"
        ? index === 0
          ? `response-opening-${interview.id}`
          : `response-${messages[index - 1]?.id ?? message.id}`
        : message.id,
    pending: false,
  }));
  if (opening)
    transcriptMessages.push({
      message: {
        id: "opening",
        role: "interviewer",
        content: streamedResponse,
        stage: interview.stage.current ?? "",
        createdAt: interview.startedAt,
      },
      key: `response-opening-${interview.id}`,
      pending: true,
    });
  if (!opening && pending && lastCandidate)
    transcriptMessages.push({
      message: {
        ...lastCandidate,
        role: "interviewer",
        content: streamedResponse,
      },
      key: `response-${lastCandidate.id}`,
      pending: true,
    });
  async function send(
    retry = false,
    candidateAnswer = answer,
    fromRecording = false,
    openingTurn = false,
  ) {
    if (
      operation ||
      (!fromRecording && (voice.transcribing || voice.listening)) ||
      (error && !retry && !openingTurn) ||
      interview.status !== "in-progress" ||
      interview.stage.current === null ||
      (!openingTurn && !retry && !candidateAnswer.trim())
    )
      return;
    const settings = readSettings();
    if (aiSettingsIssue(settings)) {
      if (fromRecording) setAnswer(candidateAnswer);
      openSettings();
      return;
    }
    const request = beginOperation(openingTurn ? "opening" : "send");
    if (!request) return;
    setError("");
    setStreamedResponse("");
    const speech = voice.beginResponse(request.controller.signal);
    try {
      if (!isCurrentOperation(request)) return;
      const next =
        retry || openingTurn
          ? request.interview
          : acceptCandidateMessage(request.interview, candidateAnswer);
      if (!openingTurn) commitOperation(request, next);
      if (fromRecording) setAnswer("");
      if (openingTurn || !retry || !lastWorkspaceSnapshot.current)
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
        openingTurn,
      );
      if (openingTurn && isCurrentOperation(request))
        saveInterviewSession({ interview: result });
      if (commitOperation(request, result)) {
        const response = result.messages.at(-1);
        if (response?.role === "interviewer") speech.finish(response);
        if (!openingTurn) setAnswer("");
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

  const startOpening = useEffectEvent(() => {
    void send(false, "", false, true);
  });
  useEffect(() => {
    if (
      !messages.length &&
      !operation &&
      !providerIssue &&
      !error &&
      interview.status === "in-progress" &&
      interview.stage.current !== null
    )
      startOpening();
  }, [
    messages.length,
    operation,
    providerIssue,
    error,
    interview.status,
    interview.stage,
  ]);

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
      {providerIssue && (
        <div
          role="alert"
          className="flex items-center justify-between gap-2 border-t px-4 py-3 text-xs text-muted-foreground"
        >
          <span>{providerIssue}</span>
          <Button size="sm" onClick={openSettings}>
            Configure provider
          </Button>
        </div>
      )}
      <div className="empty:hidden flex flex-col gap-3 px-4 pb-3">
        {" "}
        {error && (
          <div className="flex flex-col gap-3">
            <p role="alert" className="text-xs leading-5 text-muted-foreground">
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
                onClick={() =>
                  messages.length ? send(true) : send(false, "", false, true)
                }
              >
                Retry
              </Button>
              <Button size="sm" variant="ghost" onClick={openSettings}>
                AI settings
              </Button>
            </div>
          </div>
        )}
        {voice.error && (
          <div className="flex flex-col items-start gap-2">
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
          </div>
        )}
      </div>
      <form
        ref={composer}
        onKeyDownCapture={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (voice.transcribing && event.key === "Enter") {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          if (
            !voice.listening ||
            (event.key !== "Enter" && event.key !== "Escape")
          )
            return;
          // Capture before the focused recording button can activate itself.
          event.preventDefault();
          event.stopPropagation();
          if (event.repeat) return;
          if (event.key === "Escape") cancelRecording();
          else stopAndSend();
        }}
        onSubmit={(event) => {
          event.preventDefault();
          if (voice.listening) stopAndSend();
          else if (!voice.transcribing) void send();
        }}
        className="flex shrink-0 flex-col gap-3 border-t p-4"
      >
        {voice.listening ? (
          <div
            className="flex items-center"
            style={{ minHeight: composerHeight }}
          >
            <RecordingControls
              stream={voice.microphoneStream}
              seconds={voice.recordingSeconds}
              onCancel={cancelRecording}
              onStop={stopAndReview}
              onSend={stopAndSend}
              microphoneShortcut={microphoneShortcut}
            />
          </div>
        ) : voice.transcribing ? (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center justify-center gap-2 text-xs text-muted-foreground"
            style={{ minHeight: composerHeight }}
          >
            <Spinner aria-hidden="true" /> Transcribing…
          </div>
        ) : (
          <>
            <label htmlFor="interview-answer" className="sr-only">
              Your answer
            </label>
            <Textarea
              ref={answerInput}
              id="interview-answer"
              name="answer"
              placeholder="Type your answer…"
              value={answer}
              disabled={inputBlocked}
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
                {voice.speaking
                  ? "Interviewer speaking"
                  : "Shift+Enter for a new line"}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={!speechAvailable || inputBlocked}
                  aria-label="Dictate answer"
                  title={
                    speechAvailable
                      ? `Start recording — ${microphoneShortcut}`
                      : "Microphone recording is unavailable in this browser"
                  }
                  onClick={startRecording}
                >
                  <Mic aria-hidden="true" />
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
          </>
        )}
      </form>
    </section>
  );
}
