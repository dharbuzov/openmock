"use client";

import { Badge } from "@/components/ui/badge";
import { useInterviewSession } from "./interview-session-context";

export function CurrentStageBadge({
  numbered = false,
}: {
  numbered?: boolean;
}) {
  const { interview, definition } = useInterviewSession();
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
    <Badge
      variant="secondary"
      className="min-w-0 max-w-full shrink"
      title={label}
    >
      <span className="truncate">{label}</span>
    </Badge>
  );
}
