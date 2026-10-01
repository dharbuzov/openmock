"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { InterviewTimer } from "@/lib/interview/timer";
import { recognitionConstructor } from "@/lib/voice/browser";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useInterviewSession } from "./interview-session-context";

type InteractionMode = "chat" | "live";
type Controls = {
  mode: InteractionMode;
  setMode: (mode: InteractionMode) => void;
  voiceEnabled: boolean;
  setVoiceEnabled: (enabled: boolean) => void;
  speechAvailable: boolean;
  playbackAvailable: boolean;
  paused: boolean;
  toggleTimer: () => void;
  elapsed: () => number;
};
const Context = createContext<Controls | null>(null);
const subscribeCapabilities = () => () => {};
const noCapability = () => false;
export function InterviewControlsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { interview } = useInterviewSession();
  const [timer] = useState(() => new InterviewTimer(interview.startedAt));
  const [paused, setPaused] = useState(false);
  const [mode, setMode] = useState<InteractionMode>("chat");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const speechAvailable = useSyncExternalStore(
    subscribeCapabilities,
    () => Boolean(recognitionConstructor()),
    noCapability,
  );
  const playbackAvailable = useSyncExternalStore(
    subscribeCapabilities,
    () => "speechSynthesis" in window,
    noCapability,
  );
  useEffect(() => {
    if (interview.status === "completed") {
      timer.pause();
    }
  }, [interview.status, timer]);
  const value = useMemo(
    () => ({
      mode,
      setMode,
      voiceEnabled,
      setVoiceEnabled,
      speechAvailable,
      playbackAvailable,
      paused: paused || interview.status === "completed",
      elapsed: timer.elapsed,
      toggleTimer: () => {
        if (interview.status !== "in-progress") return;
        if (paused) timer.resume();
        else timer.pause();
        setPaused(!paused);
      },
    }),
    [
      mode,
      voiceEnabled,
      speechAvailable,
      playbackAvailable,
      paused,
      timer,
      interview.status,
    ],
  );
  return (
    <TooltipProvider>
      <Context value={value}>{children}</Context>
    </TooltipProvider>
  );
}
export function useInterviewControls() {
  const value = useContext(Context);
  if (!value) throw new Error("Interview controls provider is unavailable");
  return value;
}
