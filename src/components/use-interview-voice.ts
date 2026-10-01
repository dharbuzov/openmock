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
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState("");
  const recognition = useRef<BrowserRecognition | null>(null);
  const spoken = useRef(messages.at(-1)?.id);
  const transcript = useEffectEvent((text: string) => {
    if (!active || busy) return;
    if (mode === "live") onLiveAnswer(text);
    else onDictation(text);
  });
  useEffect(() => {
    const last = messages.at(-1);
    if (!last || last.id === spoken.current || last.role !== "interviewer")
      return;
    spoken.current = last.id;
    if (!voiceEnabled || !playbackAvailable || !active) return;
    recognition.current?.abort();
    const utterance = new SpeechSynthesisUtterance(last.content);
    const finish = () => setSpeaking(false);
    utterance.onend = finish;
    utterance.onerror = finish;
    utterance.onstart = () => setSpeaking(true);
    window.speechSynthesis.speak(utterance);
    return () => {
      utterance.onend = null;
      utterance.onstart = null;
      utterance.onerror = null;
      window.speechSynthesis.cancel();
      setSpeaking(false);
    };
  }, [messages, voiceEnabled, playbackAvailable, active]);
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
    instance.interimResults = false;
    instance.lang = document.documentElement.lang || "en";
    let disposed = false;
    let failed = false;
    let restart: ReturnType<typeof setTimeout> | undefined;
    const start = () => {
      if (disposed || failed) return;
      try {
        instance.start();
        setListening(true);
      } catch {
        failed = true;
        setListening(false);
        setDictating(false);
        setMode("chat");
        setError("Could not start microphone. Check browser permissions.");
      }
    };
    instance.onresult = (event) => {
      const text = finalTranscript(event);
      if (!text || disposed || failed) return;
      if (mode === "live") failed = true;
      instance.abort();
      setListening(false);
      setDictating(false);
      transcript(text);
    };
    instance.onerror = (event) => {
      if (disposed || event.error === "aborted" || event.error === "no-speech")
        return;
      failed = true;
      setListening(false);
      setDictating(false);
      setMode("chat");
      setError(
        "Microphone unavailable. Check browser permissions or use Chat.",
      );
    };
    instance.onend = () => {
      if (disposed) return;
      setListening(false);
      if (mode === "live" && !failed) restart = setTimeout(start, 300);
      else setDictating(false);
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
      setListening(false);
    };
  }, [mode, dictating, speechAvailable, active, busy, speaking, setMode]);
  return {
    listening,
    error,
    toggleMicrophone: () => {
      setError("");
      if (mode === "live") {
        setMode("chat");
        return;
      }
      setDictating(!dictating);
    },
  };
}
