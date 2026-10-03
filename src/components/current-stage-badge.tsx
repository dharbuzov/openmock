"use client";

import { Badge } from "@/components/ui/badge";
import { useInterviewSession } from "./interview-session-context";

export function CurrentStageBadge({
  numbered = false,
}: {
  numbered?: boolean;
}) {
  const { interview, definition } = useInterviewSession();
  if (interview.stage.current === null)
    return (
      <Badge variant="secondary">
        {interview.status === "completed"
          ? "Interview completed"
          : "Stages complete"}
      </Badge>
    );
  const index = definition.stages.findIndex(
    (stage) => stage.id === interview.stage.current,
  );
  const stage = definition.stages[index];
  if (!stage) return null;
  const name =
    stage.name ??
    stage.id
      .replace(/-/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  const label = numbered ? `Stage ${index + 1} · ${name}` : name;
  return (
    <Badge variant="stage" className="min-w-0 max-w-full shrink" title={label}>
      <span
        aria-hidden="true"
        className="size-1 shrink-0 rounded-full bg-current"
      />
      <span className="truncate">{label}</span>
    </Badge>
  );
}
