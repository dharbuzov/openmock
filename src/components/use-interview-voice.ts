"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  finalTranscript,
  recognitionConstructor,
  type BrowserRecognition,
} from "@/lib/voice/browser";
import type { InterviewMessage } from "@/lib/interview/types";
import { useInterviewControls } from "./interview-controls-context";

export function useInterviewVoice({
  messages,
  busy,
  active,
  onDictation,
  onLiveAnswer,
}: {
  messages: InterviewMessage[];
  busy: boolean;
  active: boolean;
  onDictation: (text: string) => void;
  onLiveAnswer: (text: string) => void;
}) {
  const { mode, setMode, voiceEnabled, speechAvailable, playbackAvailable } =
    useInterviewControls();
  const [dictating, setDictating] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [partialTranscript, setPartialTranscript] = useState("");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState("");
  const [playbackRetry, setPlaybackRetry] = useState(0);
  const playbackAttempt = useRef(0);
  const [failedOperation, setFailedOperation] = useState<
    "microphone" | "playback" | null
  >(null);
  const recognition = useRef<BrowserRecognition | null>(null);
  const stopRecording = useRef<(() => void) | null>(null);
  const spoken = useRef(messages.at(-1)?.id);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const playbackMessage = useRef<InterviewMessage | null>(null);
  const transcript = useEffectEvent((text: string, live: boolean) => {
    if (!active || busy) return;
    if (live) onLiveAnswer(text);
    else onDictation(text);
  });
  const stopPlayback = () => {
    if (utterance.current) {
      utterance.current.onend = null;
      utterance.current.onstart = null;
      utterance.current.onerror = null;
      utterance.current = null;
    }
    if (playbackAvailable) window.speechSynthesis.cancel();
    setSpeaking(false);
  };
  const play = useEffectEvent((message: InterviewMessage) => {
    if (!voiceEnabled || !playbackAvailable || !active || busy) return;
    stopPlayback();
    playbackMessage.current = message;
    setError("");
    setFailedOperation(null);
    recognition.current?.abort();
    const audio = new SpeechSynthesisUtterance(message.content);
    utterance.current = audio;
    audio.onend = () => {
      setSpeaking(false);
      utterance.current = null;
    };
    audio.onerror = (event) => {
      setSpeaking(false);
      utterance.current = null;
      if (event.error === "canceled" || event.error === "interrupted") return;
      setFailedOperation("playback");
      setError("Couldn't play the interviewer response aloud.");
    };
    audio.onstart = () => setSpeaking(true);
    try {
      window.speechSynthesis.speak(audio);
    } catch {
      setSpeaking(false);
      setFailedOperation("playback");
      setError("Couldn't play the interviewer response aloud.");
    }
  });
  useEffect(() => {
    const last =
      playbackAttempt.current !== playbackRetry
        ? playbackMessage.current
        : messages.at(-1);
    if (
      !last ||
      (last.id === spoken.current &&
        playbackAttempt.current === playbackRetry) ||
      last.role !== "interviewer"
    )
      return;
    // Wait for the send operation to settle before speaking its validated response.
    if (busy) return;
    spoken.current = last.id;
    playbackAttempt.current = playbackRetry;
    // Synchronize browser speech playback; state changes come from its lifecycle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    play(last);
  }, [messages, busy, playbackRetry]);
  useEffect(() => {
    return () => stopPlayback();
    // stopPlayback only uses browser capability and refs; this is playback cleanup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, voiceEnabled, playbackAvailable]);
  useEffect(() => {
    if (!listening) return;
    const started = Date.now();
    const interval = setInterval(
      () => setRecordingSeconds(Math.floor((Date.now() - started) / 1000)),
      250,
    );
    return () => clearInterval(interval);
  }, [listening]);
  useEffect(() => {
    if (
      !active ||
      busy ||
      speaking ||
      !speechAvailable ||
      (mode !== "live" && !dictating)
    )
      return;
    const Constructor = recognitionConstructor();
    if (!Constructor) return;
    const instance = new Constructor();
    recognition.current = instance;
    instance.continuous = mode === "live";
    instance.interimResults = true;
    instance.lang = document.documentElement.lang || "en";
    const live = mode === "live";
    let disposed = false;
    let failed = false;
    let stopping = false;
    let delivered = false;
    let manualStop = false;
    let finalText = "";
    let restart: ReturnType<typeof setTimeout> | undefined;
    const deliver = (text: string) => {
      if (delivered || disposed || failed || !text) return;
      delivered = true;
      setTranscribing(false);
      setPartialTranscript("");
      transcript(text, live);
    };
    const start = () => {
      if (disposed || failed || stopping) return;
      try {
        instance.start();
        setListening(true);
        setRecordingSeconds(0);
        setPartialTranscript("");
      } catch {
        failed = true;
        setListening(false);
        setDictating(false);
        setMode("chat");
        setFailedOperation("microphone");
        setError("Could not start microphone. Check browser permissions.");
      }
    };
    instance.onresult = (event) => {
      if (disposed || failed || delivered) return;
      const parts = Array.from(event.results);
      setPartialTranscript(
        parts
          .map((result) => result[0].transcript)
          .join(" ")
          .trim(),
      );
      finalText = parts
        .filter((result) => result.isFinal)
        .map((result) => result[0].transcript)
        .join(" ")
        .trim();
      const text = finalTranscript(event);
      if (!text) return;
      // Keep the existing Live behavior: a final utterance submits one answer.
      // Chat dictation likewise finalizes into the draft, never a partial message.
      deliver(finalText);
      stopping = true;
      instance.abort();
      setListening(false);
      setDictating(false);
    };
    instance.onerror = (event) => {
      if (disposed || event.error === "aborted" || event.error === "no-speech")
        return;
      failed = true;
      setListening(false);
      setTranscribing(false);
      setDictating(false);
      setMode("chat");
      setFailedOperation("microphone");
      setError(
        "Couldn't transcribe your answer. Check microphone permissions or try again.",
      );
    };
    instance.onend = () => {
      if (disposed) return;
      setListening(false);
      setTranscribing(false);
      if (manualStop && live) setMode("chat");
      if (finalText) deliver(finalText);
      if (live && !failed && !stopping && !delivered)
        restart = setTimeout(start, 300);
      else setDictating(false);
    };
    stopRecording.current = () => {
      if (stopping || disposed) return;
      stopping = true;
      manualStop = true;
      setListening(false);
      setTranscribing(true);
      try {
        instance.stop();
      } catch {
        setTranscribing(false);
        setFailedOperation("microphone");
        setError(
          "Couldn't finish transcription. Please record your answer again.",
        );
        instance.abort();
        setDictating(false);
      }
    };
    start();
    return () => {
      disposed = true;
      clearTimeout(restart);
      instance.onresult = null;
      instance.onerror = null;
      instance.onend = null;
      instance.abort();
      recognition.current = null;
      stopRecording.current = null;
      setListening(false);
      setTranscribing(false);
      setPartialTranscript("");
    };
  }, [mode, dictating, speechAvailable, active, busy, speaking, setMode]);
  const startMicrophone = () => {
    if (busy || !active || !speechAvailable || transcribing) return;
    setError("");
    setFailedOperation(null);
    stopPlayback();
    setDictating(true);
  };
  return {
    listening,
    transcribing,
    partialTranscript,
    recordingSeconds,
    speaking,
    error,
    failedOperation,
    stopPlayback,
    retry: () => {
      setError("");
      if (failedOperation === "playback") {
        setPlaybackRetry((attempt) => attempt + 1);
      } else startMicrophone();
      setFailedOperation(null);
    },
    toggleMicrophone: () => {
      if (listening) stopRecording.current?.();
      else startMicrophone();
    },
  };
}
