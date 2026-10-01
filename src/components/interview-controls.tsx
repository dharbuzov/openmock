"use client";

import { useEffect, useState } from "react";
import { Clock, MessageCircle, Mic, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
  const { mode, setMode, speechAvailable, paused, toggleTimer, elapsed } =
    useInterviewControls();
  const { interview, definition } = useInterviewSession();
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
      <span className="hidden text-xs text-muted-foreground xl:inline">
        Interaction
      </span>
      <ToggleGroup
        aria-label="Interaction mode"
        value={[mode]}
        onValueChange={(values) => {
          if (values[0] === "chat" || values[0] === "live") setMode(values[0]);
        }}
        variant="outline"
        size="sm"
        spacing={0}
      >
        <ToggleGroupItem value="chat" aria-label="Chat interaction">
          <MessageCircle data-icon="inline-start" />
          Chat
        </ToggleGroupItem>
        <ToggleGroupItem
          value="live"
          aria-label="Live interaction"
          disabled={!speechAvailable}
          title={
            speechAvailable
              ? "Continuous voice interaction"
              : "Speech recognition is unavailable in this browser"
          }
        >
          <Mic data-icon="inline-start" />
          Live
        </ToggleGroupItem>
      </ToggleGroup>
      <Separator orientation="vertical" className="h-5" />
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
                disabled={interview.status !== "in-progress"}
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
