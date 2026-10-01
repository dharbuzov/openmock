"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { InterviewTimer } from "@/lib/interview/timer";
import { recognitionConstructor } from "@/lib/voice/browser";
import { TooltipProvider } from "@/components/ui/tooltip";

import type { InteractionMode } from "./interaction-mode-control";
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
  initialMode = "chat",
}: {
  children: ReactNode;
  initialMode?: InteractionMode;
}) {
  const [timer] = useState(() => new InterviewTimer());
  const [paused, setPaused] = useState(true);
  const [mode, setMode] = useState<InteractionMode>(initialMode);
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
  const value = useMemo(
    () => ({
      mode,
      setMode,
      voiceEnabled,
      setVoiceEnabled,
      speechAvailable,
      playbackAvailable,
      paused,
      elapsed: timer.elapsed,
      toggleTimer: () => {
        if (paused) timer.resume();
        else timer.pause();
        setPaused(!paused);
      },
    }),
    [mode, voiceEnabled, speechAvailable, playbackAvailable, paused, timer],
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
