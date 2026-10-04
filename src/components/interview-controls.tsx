"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Clock, Pause, Play, Mic } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatRemaining } from "@/lib/interview/timer";
import { cn } from "cn";
import { useInterviewControls } from "./interview-controls-context";
import { useInterviewSession } from "./interview-session-context";

export function InterviewControls() {
  const shortcut = useSyncExternalStore(
    () => () => {},
    () =>
      typeof navigator !== "undefined" &&
      /Mac|iPhone|iPad/.test(navigator.platform)
        ? "⌘M"
        : "Ctrl+M",
    () => "Ctrl+M",
  );
  const { recordingState, paused, toggleTimer, elapsed } =
    useInterviewControls();
  const { definition } = useInterviewSession();
  const duration = definition.duration.defaultMinutes * 60_000;
  const [remaining, setRemaining] = useState(duration);
  const time = formatRemaining(remaining);
  const overtime = remaining < 0;
  useEffect(() => {
    const update = () => setRemaining(duration - elapsed());
    update();
    if (paused) return;
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [duration, elapsed, paused]);
  const timerLabel = paused
    ? "Resume interview timer"
    : "Pause interview timer";
  return (
    <div className="flex shrink-0 items-center gap-1 sm:gap-3">
      <span
        role="status"
        className="hidden items-center gap-1.5 text-xs text-muted-foreground lg:inline-flex"
      >
        {recordingState.startsWith("transcribing-") ? (
          <Spinner aria-hidden="true" className="size-3.5" />
        ) : (
          <Mic aria-hidden="true" className="size-3.5" />
        )}
        {recordingState === "recording"
          ? "Listening…"
          : recordingState.startsWith("transcribing-")
            ? "Transcribing…"
            : `Type or press ${shortcut} to talk`}
      </span>
      <Separator
        orientation="vertical"
        aria-hidden="true"
        className="hidden h-5 self-center! bg-border/60 lg:block"
      />
      <div className="flex items-center gap-1">
        <Clock
          aria-hidden="true"
          className={cn(
            "hidden size-3.5 sm:block",
            overtime ? "text-destructive" : "text-muted-foreground",
          )}
        />
        <span
          aria-label={`${overtime ? "Interview overtime" : "Remaining interview time"} ${time}${paused ? ", paused" : ""}`}
          className={cn(
            "font-mono text-xs tabular-nums",
            overtime && "text-destructive",
          )}
        >
          {time}
        </span>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={timerLabel}
                className={
                  paused
                    ? "text-green-700 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                    : "text-amber-700 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300"
                }
                onClick={toggleTimer}
              />
            }
          >
            {paused ? (
              <Play aria-hidden="true" />
            ) : (
              <Pause aria-hidden="true" />
            )}
          </TooltipTrigger>
          <TooltipContent>{timerLabel}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
