"use client";

import { useEffect, useState } from "react";
import { Clock, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const { paused, toggleTimer, elapsed } = useInterviewControls();
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
