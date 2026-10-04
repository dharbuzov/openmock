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
import { TooltipProvider } from "@/components/ui/tooltip";
import { readSettings } from "@/lib/settings/storage";

export type RecordingState =
  "idle" | "recording" | "transcribing-for-edit" | "transcribing-for-send";

type Controls = {
  recordingState: RecordingState;
  setRecordingState: (state: RecordingState) => void;
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
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [timer] = useState(() => new InterviewTimer());
  const [paused, setPaused] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(
    () => readSettings().interviewerVoiceEnabled,
  );
  const speechAvailable = useSyncExternalStore(
    subscribeCapabilities,
    () =>
      typeof MediaRecorder !== "undefined" &&
      Boolean(navigator.mediaDevices?.getUserMedia),
    noCapability,
  );
  const playbackAvailable = useSyncExternalStore(
    subscribeCapabilities,
    () => typeof AudioContext !== "undefined",
    noCapability,
  );
  const value = useMemo(
    () => ({
      recordingState,
      setRecordingState,
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
    [
      recordingState,
      voiceEnabled,
      speechAvailable,
      playbackAvailable,
      paused,
      timer,
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
