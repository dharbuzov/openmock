"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  LocalWhisper,
  LocalKokoro,
  SpeechServiceBusyError,
} from "@/lib/voice/local-speech";
import { readSpeechSettings } from "@/lib/settings/storage";
import { AudioQueue } from "@/lib/voice/audio-queue";
import { SpeechStream, SpeechLatency } from "@/lib/voice/speech-stream";
import type { InterviewMessage } from "@/lib/interview/types";
import { useInterviewControls } from "./interview-controls-context";

export function useInterviewVoice({
  messages,
  busy,
  active,
  onDictation,
  onRecordedAnswer,
  finishing = false,
}: {
  messages: InterviewMessage[];
  busy: boolean;
  finishing?: boolean;
  active: boolean;
  onDictation: (text: string) => void;
  onRecordedAnswer?: (text: string) => void;
}) {
  const {
    recordingState,
    setRecordingState,
    voiceEnabled,
    speechAvailable,
    playbackAvailable,
  } = useInterviewControls();
  const [microphoneStream, setMicrophoneStream] = useState<MediaStream | null>(
    null,
  );
  const listening = recordingState === "recording";
  const transcribing = recordingState.startsWith("transcribing-");
  const recordingIntent = useRef<"edit" | "send">("edit");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState("");
  const [failedOperation, setFailedOperation] = useState<
    "microphone" | "playback" | null
  >(null);
  const recording = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const recordingRequest = useRef<AbortController | null>(null);
  const recordingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playback = useRef<{ stream: SpeechStream; detach: () => void } | null>(
    null,
  );
  const audioContext = useRef<AudioContext | null>(null);
  const audioQueue = useRef<AudioQueue | null>(null);
  const latency = useRef<SpeechLatency | null>(null);
  const playbackGeneration = useRef(0);
  const spoken = useRef(messages.at(-1)?.id);
  const playbackMessage = useRef<InterviewMessage | null>(null);
  const deliver = (text: string, intent: "edit" | "send") => {
    if (active && !busy && text.trim()) {
      if (intent === "send") onRecordedAnswer?.(text.trim());
      else onDictation(text.trim());
    }
  };
  const deliverLatest = useRef(deliver);
  useEffect(() => {
    deliverLatest.current = deliver;
  }, [active, busy, onDictation, onRecordedAnswer]);

  function releaseMicrophone() {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    setMicrophoneStream(null);
    if (recordingTimer.current) clearTimeout(recordingTimer.current);
    recordingTimer.current = null;
  }
  function cancelRecording() {
    recordingRequest.current?.abort();
    recordingRequest.current = null;
    const recorder = recording.current;
    recording.current = null;
    if (recorder) {
      recorder.onstop = null;
      recorder.ondataavailable = null;
      recorder.onerror = null;
      if (recorder.state !== "inactive") recorder.stop();
    }
    releaseMicrophone();
    setRecordingState("idle");
  }
  function stopRecording(intent: "edit" | "send" = "edit") {
    if (recording.current?.state !== "recording") return;
    recordingIntent.current = intent;
    setRecordingState(
      intent === "send" ? "transcribing-for-send" : "transcribing-for-edit",
    );
    recording.current.stop();
  }
  function stopPlayback() {
    playbackGeneration.current++;
    playback.current?.stream.cancel();
    playback.current?.detach();
    playback.current = null;
    audioQueue.current?.cancel();
    setSpeaking(false);
  }

  function beginResponse(signal?: AbortSignal) {
    stopPlayback();
    const generation = playbackGeneration.current;
    latency.current = new SpeechLatency();
    let current: SpeechStream | null = null;
    if (
      voiceEnabled &&
      playbackAvailable &&
      active &&
      !recordingRequest.current
    ) {
      setError("");
      setFailedOperation(null);
      try {
        if (!audioContext.current) {
          audioContext.current = new AudioContext();
          audioQueue.current = new AudioQueue(
            audioContext.current,
            setSpeaking,
            () => latency.current?.mark("First audio playback"),
          );
        }
        // Resume inside Send/Retry's user gesture, before awaiting LLM or HTTP work.
        const ready = audioContext.current.resume();
        void ready.catch(() => {});
        const queue = audioQueue.current!;
        const settings = readSpeechSettings();
        const timing = latency.current;
        current = new SpeechStream(
          new LocalKokoro(settings.baseUrl),
          settings.voice,
          async (audio, chunkSignal) => {
            if (!chunkSignal.aborted) await queue.enqueue(audio, chunkSignal);
          },
          (cause) => {
            if (generation !== playbackGeneration.current) return;
            setFailedOperation("playback");
            setError(
              cause instanceof SpeechServiceBusyError
                ? cause.message + " Text remains available."
                : "Couldn't play part of the interviewer audio. Text remains available.",
            );
          },
          (event) => timing.mark(event),
        );
        const cancel = () => {
          if (generation === playbackGeneration.current) stopPlayback();
        };
        signal?.addEventListener("abort", cancel, { once: true });
        playback.current = {
          stream: current,
          detach: () => signal?.removeEventListener("abort", cancel),
        };
        if (signal?.aborted) cancel();
      } catch {
        setFailedOperation("playback");
        setError(
          "Browser audio playback is unavailable. Text remains available.",
        );
      }
    }
    return {
      push: (snapshot: string) => current?.push(snapshot),
      finish: (message: InterviewMessage) => {
        spoken.current = message.id;
        playbackMessage.current = message;
        current?.push(message.content, true);
      },
      cancel: () => {
        if (generation === playbackGeneration.current) stopPlayback();
      },
    };
  }

  const play = (message: InterviewMessage) => {
    if (busy || !active) return;
    beginResponse().finish(message);
  };
  const playCommitted = useEffectEvent(play);
  const cancelRecordingOnCleanup = useEffectEvent(cancelRecording);
  useEffect(() => {
    const last = messages.at(-1);
    if (
      busy ||
      !last ||
      last.id === spoken.current ||
      last.role !== "interviewer"
    )
      return;
    spoken.current = last.id;
    // Fallback for responses generated without streaming. Streamed turns mark
    // their final ID in finish(), so committing text cannot replay their audio.
    void playCommitted(last);
  }, [messages, busy]);
  useEffect(
    () => () => {
      cancelRecordingOnCleanup();
      // Lifecycle cleanup releases microphone tracks and pending requests.
    },
    [active, busy],
  );
  useEffect(
    () => () => {
      stopPlayback();
      // Playback resources are owned by refs, independent of render closures.
    },
    [active, voiceEnabled, finishing],
  );
  useEffect(
    () => () => {
      void audioContext.current?.close().catch(() => {});
      audioContext.current = null;
      audioQueue.current = null;
    },
    [],
  );
  useEffect(() => {
    if (!listening) return;
    const started = Date.now();
    const interval = setInterval(
      () => setRecordingSeconds(Math.floor((Date.now() - started) / 1000)),
      250,
    );
    return () => clearInterval(interval);
  }, [listening]);

  async function startMicrophone() {
    if (busy || !active || !speechAvailable || recordingRequest.current) return;
    const request = new AbortController();
    stopPlayback();
    recordingRequest.current = request;
    setError("");
    setFailedOperation(null);
    try {
      const settings = readSpeechSettings();
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (request.signal.aborted) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      setMicrophoneStream(media);
      recordingIntent.current = "edit";
      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(
        media,
        mimeType ? { mimeType } : undefined,
      );
      recording.current = recorder;
      const chunks: Blob[] = [];
      let bytes = 0;
      recorder.ondataavailable = ({ data }) => {
        bytes += data.size;
        if (bytes > 10 * 1024 * 1024) {
          cancelRecording();
          setFailedOperation("microphone");
          setError("Recording too large. Record a shorter answer or type it.");
        } else if (data.size) chunks.push(data);
      };
      recorder.onerror = () => {
        cancelRecording();
        setFailedOperation("microphone");
        setError("Microphone recording failed. You can still type.");
      };
      recorder.onstop = async () => {
        recording.current = null;
        releaseMicrophone();
        const intent = recordingIntent.current;
        setRecordingState(
          intent === "send" ? "transcribing-for-send" : "transcribing-for-edit",
        );
        try {
          const result = await new LocalWhisper(settings.baseUrl).transcribe(
            new Blob(chunks, { type: recorder.mimeType }),
            AbortSignal.any([request.signal, AbortSignal.timeout(180_000)]),
          );
          if (request.signal.aborted) return;
          if (!result.text.trim()) throw new Error("No speech detected.");
          recordingRequest.current = null;
          setRecordingState("idle");
          deliverLatest.current(result.text, intent);
        } catch {
          if (!request.signal.aborted) {
            setFailedOperation("microphone");
            setError(
              "Couldn't transcribe your answer. Check Local Speech or type your answer.",
            );
          }
        } finally {
          if (!request.signal.aborted) {
            recordingRequest.current = null;
            setRecordingState("idle");
          }
        }
      };
      recorder.start(1000);
      setRecordingSeconds(0);
      setRecordingState("recording");
      recordingTimer.current = setTimeout(() => {
        stopRecording("edit");
      }, 120_000);
    } catch {
      if (request.signal.aborted) return;
      cancelRecording();
      setFailedOperation("microphone");
      setError(
        "Could not start microphone. Check browser permissions; you can still type.",
      );
    }
  }
  return {
    recordingState,
    isRecordingPending: () => recordingRequest.current !== null,
    microphoneStream,
    stopRecording,
    cancelRecording,
    startRecording: () => void startMicrophone(),
    stopAndReview: () => stopRecording("edit"),
    stopAndSend: () => stopRecording("send"),
    listening,
    transcribing,
    partialTranscript: "",
    recordingSeconds,
    speaking,
    error,
    failedOperation,
    stopPlayback,
    beginResponse,
    retry: () => {
      if (playback.current?.stream.isPending) return;
      if (failedOperation === "playback" && playbackMessage.current)
        void play(playbackMessage.current);
      else void startMicrophone();
    },
    toggleMicrophone: () => {
      if (recording.current?.state === "recording") stopRecording("edit");
      else void startMicrophone();
    },
  };
}
